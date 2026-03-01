import { promises as fs } from "fs";
import type { Stats } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import type { Attributes, SFTPWrapper } from "ssh2";
import {
  PROJECT_FILES_MAX_EDIT_BYTES,
  PROJECT_FILES_MAX_ENTRIES,
  PROJECT_FILES_MAX_READ_BYTES,
} from "@/lib/constants";
import type {
  ProjectFileDeleteRequest,
  ProjectFileEntryInfo,
  ProjectFileListResponse,
  ProjectFileReadResponse,
  ProjectFileRenameRequest,
  ProjectFileWriteRequest,
  ProjectFileWriteResponse,
  ProjectType,
} from "@/lib/types";
import { shellQuote } from "@/lib/shellQuote";
import { sshManager } from "@/server/ssh/sshManager";

const execFileAsync = promisify(execFile);

type ProjectRecord = {
  id: string;
  type: ProjectType;
  path: string;
  sshConfigId: string | null;
  dockerContainer: string | null;
};

class FileApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function fail(message: string, status: number): never {
  throw new FileApiError(message, status);
}

function normalizeRelativePath(raw: string | null | undefined): string {
  const input = (raw ?? "").trim();
  if (!input || input === ".") return "";
  if (path.isAbsolute(input)) fail("Path must be project-relative", 400);
  if (input.includes("\\")) fail("Backslash is not allowed in path", 400);
  const parts = input.split("/").filter((p) => p.length > 0);
  if (parts.some((p) => p === "." || p === "..")) {
    fail("Path traversal is not allowed", 400);
  }
  return parts.join("/");
}

function ensureWithinRoot(rootReal: string, targetReal: string): void {
  const rel = path.relative(rootReal, targetReal);
  if (rel === "") return;
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    fail("Path is outside project root", 400);
  }
}

function ensureWithinRootPosix(rootReal: string, targetReal: string): void {
  const rel = path.posix.relative(rootReal, targetReal);
  if (rel === "") return;
  if (rel.startsWith("..") || path.posix.isAbsolute(rel)) {
    fail("Path is outside project root", 400);
  }
}

function bytesToText(buffer: Buffer): {
  isBinary: boolean;
  content: string | null;
  encoding: "utf8" | "binary";
} {
  const isBinary = buffer.includes(0);
  if (isBinary) {
    return { isBinary: true, content: null, encoding: "binary" };
  }
  return {
    isBinary: false,
    content: buffer.toString("utf8"),
    encoding: "utf8",
  };
}

type LocalResolvedExisting = {
  rootReal: string;
  absPath: string;
  realPath: string;
  st: Stats;
  lst: Stats;
  relPath: string;
};

const MODE_TYPE_MASK = 0o170000;
const MODE_DIRECTORY = 0o040000;
const MODE_FILE = 0o100000;
const MODE_SYMLINK = 0o120000;

function attrsMode(attrs: Attributes): number {
  return Number(attrs.mode ?? 0);
}

function attrsIsDirectory(attrs: Attributes): boolean {
  return (attrsMode(attrs) & MODE_TYPE_MASK) === MODE_DIRECTORY;
}

function attrsIsFile(attrs: Attributes): boolean {
  return (attrsMode(attrs) & MODE_TYPE_MASK) === MODE_FILE;
}

function attrsIsSymlink(attrs: Attributes): boolean {
  return (attrsMode(attrs) & MODE_TYPE_MASK) === MODE_SYMLINK;
}

async function resolveLocalRoot(projectPath: string): Promise<string> {
  const rootReal = await fs.realpath(projectPath).catch(() => {
    fail("Project root does not exist", 400);
  });
  const st = await fs.stat(rootReal).catch(() => {
    fail("Project root is not accessible", 400);
  });
  if (!st.isDirectory()) fail("Project root must be a directory", 400);
  return rootReal;
}

async function resolveLocalExisting(
  projectPath: string,
  relPathRaw: string,
): Promise<LocalResolvedExisting> {
  const relPath = normalizeRelativePath(relPathRaw);
  const rootReal = await resolveLocalRoot(projectPath);
  const absPath = relPath ? path.resolve(rootReal, relPath) : rootReal;
  const lst = await fs.lstat(absPath).catch(() => {
    fail("Path does not exist", 404);
  });
  if (lst.isSymbolicLink()) fail("Symlink operations are not allowed", 400);
  const realPath = await fs.realpath(absPath).catch(() => {
    fail("Path is not accessible", 400);
  });
  ensureWithinRoot(rootReal, realPath);
  const st = await fs.stat(realPath).catch(() => {
    fail("Path is not accessible", 400);
  });
  return { rootReal, absPath, realPath, st, lst, relPath };
}

async function resolveLocalParentForCreate(
  projectPath: string,
  relPathRaw: string,
): Promise<{
  rootReal: string;
  targetAbs: string;
  parentReal: string;
  relPath: string;
}> {
  const relPath = normalizeRelativePath(relPathRaw);
  if (!relPath) fail("Path is required", 400);
  const rootReal = await resolveLocalRoot(projectPath);
  const targetAbs = path.resolve(rootReal, relPath);
  const parentAbs = path.dirname(targetAbs);
  const parentReal = await fs.realpath(parentAbs).catch(() => {
    fail("Parent directory does not exist", 400);
  });
  ensureWithinRoot(rootReal, parentReal);
  return { rootReal, targetAbs, parentReal, relPath };
}

function toRelativeFromRoot(rootReal: string, fullPath: string): string {
  const rel = path.relative(rootReal, fullPath);
  if (!rel) return "";
  return rel.split(path.sep).join("/");
}

function attrsToEntry(
  name: string,
  relPath: string,
  attrs: Attributes,
): ProjectFileEntryInfo {
  const isDir = attrsIsDirectory(attrs);
  const isSymlink = attrsIsSymlink(attrs);
  const size = isDir ? null : Number(attrs.size ?? 0);
  const mtimeMs = attrs.mtime ? Number(attrs.mtime) * 1000 : null;
  return { name, path: relPath, isDir, isSymlink, size, mtimeMs };
}

function sftpRealpath(sftp: SFTPWrapper, rawPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    sftp.realpath(rawPath, (err, resolvedPath) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(resolvedPath);
    });
  });
}

function sftpLstat(sftp: SFTPWrapper, rawPath: string): Promise<Attributes> {
  return new Promise((resolve, reject) => {
    sftp.lstat(rawPath, (err, attrs) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(attrs);
    });
  });
}

function sftpStat(sftp: SFTPWrapper, rawPath: string): Promise<Attributes> {
  return new Promise((resolve, reject) => {
    sftp.stat(rawPath, (err, attrs) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(attrs);
    });
  });
}

function sftpReadDir(
  sftp: SFTPWrapper,
  rawPath: string,
): Promise<Array<{ filename: string; attrs: Attributes }>> {
  return new Promise((resolve, reject) => {
    sftp.readdir(rawPath, (err, entries) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(entries ?? []);
    });
  });
}

function sftpReadFile(sftp: SFTPWrapper, rawPath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    sftp.readFile(rawPath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(Buffer.isBuffer(data) ? data : Buffer.from(data));
    });
  });
}

function sftpWriteFile(
  sftp: SFTPWrapper,
  rawPath: string,
  data: Buffer,
): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.writeFile(rawPath, data, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function sftpMkdir(sftp: SFTPWrapper, rawPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.mkdir(rawPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function sftpRename(
  sftp: SFTPWrapper,
  fromPath: string,
  toPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.rename(fromPath, toPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function sftpUnlink(sftp: SFTPWrapper, rawPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.unlink(rawPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function sftpRmdir(sftp: SFTPWrapper, rawPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.rmdir(rawPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

async function sftpDeleteRecursive(
  sftp: SFTPWrapper,
  rawPath: string,
): Promise<void> {
  const attrs = await sftpLstat(sftp, rawPath);
  if (attrsIsSymlink(attrs)) fail("Symlink operations are not allowed", 400);
  if (!attrsIsDirectory(attrs)) {
    await sftpUnlink(sftp, rawPath);
    return;
  }

  const entries = await sftpReadDir(sftp, rawPath);
  for (const entry of entries) {
    if (entry.filename === "." || entry.filename === "..") continue;
    const child = path.posix.join(rawPath, entry.filename);
    if (attrsIsDirectory(entry.attrs)) {
      await sftpDeleteRecursive(sftp, child);
      continue;
    }
    if (attrsIsSymlink(entry.attrs))
      fail("Symlink operations are not allowed", 400);
    await sftpUnlink(sftp, child);
  }
  await sftpRmdir(sftp, rawPath);
}

function fromSftpError(error: unknown, fallback: string): never {
  const message = error instanceof Error ? error.message : fallback;
  const text = message.toLowerCase();
  if (
    text.includes("no such file") ||
    text.includes("not found") ||
    text.includes("failure")
  ) {
    fail(fallback, 404);
  }
  fail(message, 400);
}

async function withSshRoot<T>(
  project: ProjectRecord,
  fn: (sftp: SFTPWrapper, rootReal: string) => Promise<T>,
): Promise<T> {
  if (!project.sshConfigId) fail("SSH project is missing sshConfigId", 400);
  return sshManager.withSftp(project.sshConfigId, async (sftp: SFTPWrapper) => {
    const rootReal = await sftpRealpath(sftp, project.path).catch(() => {
      fail("Project root does not exist on SSH host", 400);
    });
    return fn(sftp, rootReal);
  });
}

function normalizeSshRelative(pathRaw: string): string {
  const rel = normalizeRelativePath(pathRaw);
  if (!rel) return "";
  return rel.split(path.sep).join("/");
}

type DockerExecOptions = {
  input?: string;
};

const DOCKER_LIST_SCRIPT = [
  'ROOT="$1"',
  'REL="$2"',
  'resolve_root() { cd "$ROOT" 2>/dev/null && pwd -P; }',
  'mtime() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0; }',
  'CANON_ROOT=$(resolve_root) || { echo "__ERR__:ROOT"; exit 1; }',
  'TARGET="$CANON_ROOT"',
  'if [ -n "$REL" ]; then TARGET="$CANON_ROOT/$REL"; fi',
  'CANON_TARGET=$(cd "$TARGET" 2>/dev/null && pwd -P) || { echo "__ERR__:NOT_DIR"; exit 1; }',
  'case "$CANON_TARGET/" in "$CANON_ROOT"/*|"$CANON_ROOT"/) ;; *) echo "__ERR__:OUTSIDE"; exit 1 ;; esac',
  'echo "__ROOT__"',
  'echo "$CANON_ROOT"',
  'echo "__CURRENT__"',
  'echo "$CANON_TARGET"',
  'echo "__ENTRIES__"',
  'find "$CANON_TARGET" -mindepth 1 -maxdepth 1 -print | while IFS= read -r P; do N=$(basename "$P"); if [ -L "$P" ]; then T=l; S=""; M=""; elif [ -d "$P" ]; then T=d; S=""; M=$(mtime "$P"); else T=f; S=$(wc -c < "$P" | tr -d " "); M=$(mtime "$P"); fi; printf "%s\t%s\t%s\t%s\n" "$T" "$N" "${S:-}" "${M:-}"; done',
].join("; ");

const DOCKER_READ_SCRIPT = [
  'ROOT="$1"',
  'REL="$2"',
  'MAX_BYTES="$3"',
  'resolve_root() { cd "$ROOT" 2>/dev/null && pwd -P; }',
  'mtime() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0; }',
  'CANON_ROOT=$(resolve_root) || { echo "__ERR__:ROOT"; exit 1; }',
  '[ -n "$REL" ] || { echo "__ERR__:NOT_FILE"; exit 1; }',
  'RAW="$CANON_ROOT/$REL"',
  'CANON_PARENT=$(cd "$(dirname "$RAW")" 2>/dev/null && pwd -P) || { echo "__ERR__:NOT_FILE"; exit 1; }',
  'CANON_FILE="$CANON_PARENT/$(basename "$RAW")"',
  'case "$CANON_FILE" in "$CANON_ROOT"/*) ;; *) echo "__ERR__:OUTSIDE"; exit 1 ;; esac',
  '[ -L "$CANON_FILE" ] && { echo "__ERR__:SYMLINK"; exit 1; }',
  '[ -f "$CANON_FILE" ] || { echo "__ERR__:NOT_FILE"; exit 1; }',
  'SIZE=$(wc -c < "$CANON_FILE" | tr -d " ")',
  '[ "$SIZE" -le "$MAX_BYTES" ] || { echo "__ERR__:TOO_LARGE"; exit 1; }',
  'MT=$(mtime "$CANON_FILE")',
  'echo "__OK__"',
  'echo "$SIZE"',
  'echo "$MT"',
  'base64 < "$CANON_FILE" | tr -d "\n"',
].join("; ");

const DOCKER_WRITE_STDIN_SCRIPT = [
  'ROOT="$1"',
  'REL="$2"',
  'EXPECTED_SEC="$3"',
  'ALLOW_CREATE="$4"',
  'resolve_root() { cd "$ROOT" 2>/dev/null && pwd -P; }',
  'mtime() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0; }',
  'CANON_ROOT=$(resolve_root) || { echo "__ERR__:ROOT"; exit 1; }',
  '[ -n "$REL" ] || { echo "__ERR__:NOT_FILE"; exit 1; }',
  'RAW="$CANON_ROOT/$REL"',
  'CANON_PARENT=$(cd "$(dirname "$RAW")" 2>/dev/null && pwd -P) || { echo "__ERR__:PARENT"; exit 1; }',
  'CANON_FILE="$CANON_PARENT/$(basename "$RAW")"',
  'case "$CANON_FILE" in "$CANON_ROOT"/*) ;; *) echo "__ERR__:OUTSIDE"; exit 1 ;; esac',
  'if [ -e "$CANON_FILE" ]; then EXISTS=1; else EXISTS=0; fi',
  '[ "$EXISTS" -eq 1 ] && [ -L "$CANON_FILE" ] && { echo "__ERR__:SYMLINK"; exit 1; }',
  '[ "$EXISTS" -eq 1 ] && [ -d "$CANON_FILE" ] && { echo "__ERR__:EXISTS_DIR"; exit 1; }',
  '[ "$EXISTS" -eq 0 ] && [ "$ALLOW_CREATE" != "1" ] && { echo "__ERR__:NO_CREATE"; exit 1; }',
  'if [ "$EXISTS" -eq 1 ] && [ -n "$EXPECTED_SEC" ]; then CUR=$(mtime "$CANON_FILE"); [ "$CUR" = "$EXPECTED_SEC" ] || { echo "__ERR__:CONFLICT"; exit 1; }; fi',
  'TMP="$CANON_FILE.orbit-tmp-$$"',
  'cat > "$TMP" || { rm -f "$TMP" 2>/dev/null || true; echo "__ERR__:PERMISSION"; exit 1; }',
  'mv "$TMP" "$CANON_FILE" || { rm -f "$TMP" 2>/dev/null || true; echo "__ERR__:PERMISSION"; exit 1; }',
  'SIZE=$(wc -c < "$CANON_FILE" | tr -d " ")',
  'MT=$(mtime "$CANON_FILE")',
  'echo "__OK__"',
  'echo "$SIZE"',
  'echo "$MT"',
].join("; ");

const DOCKER_WRITE_B64_SCRIPT = [
  'ROOT="$1"',
  'REL="$2"',
  'EXPECTED_SEC="$3"',
  'ALLOW_CREATE="$4"',
  'PAYLOAD_B64="$5"',
  'resolve_root() { cd "$ROOT" 2>/dev/null && pwd -P; }',
  'mtime() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0; }',
  'CANON_ROOT=$(resolve_root) || { echo "__ERR__:ROOT"; exit 1; }',
  '[ -n "$REL" ] || { echo "__ERR__:NOT_FILE"; exit 1; }',
  'RAW="$CANON_ROOT/$REL"',
  'CANON_PARENT=$(cd "$(dirname "$RAW")" 2>/dev/null && pwd -P) || { echo "__ERR__:PARENT"; exit 1; }',
  'CANON_FILE="$CANON_PARENT/$(basename "$RAW")"',
  'case "$CANON_FILE" in "$CANON_ROOT"/*) ;; *) echo "__ERR__:OUTSIDE"; exit 1 ;; esac',
  'if [ -e "$CANON_FILE" ]; then EXISTS=1; else EXISTS=0; fi',
  '[ "$EXISTS" -eq 1 ] && [ -L "$CANON_FILE" ] && { echo "__ERR__:SYMLINK"; exit 1; }',
  '[ "$EXISTS" -eq 1 ] && [ -d "$CANON_FILE" ] && { echo "__ERR__:EXISTS_DIR"; exit 1; }',
  '[ "$EXISTS" -eq 0 ] && [ "$ALLOW_CREATE" != "1" ] && { echo "__ERR__:NO_CREATE"; exit 1; }',
  'if [ "$EXISTS" -eq 1 ] && [ -n "$EXPECTED_SEC" ]; then CUR=$(mtime "$CANON_FILE"); [ "$CUR" = "$EXPECTED_SEC" ] || { echo "__ERR__:CONFLICT"; exit 1; }; fi',
  'TMP="$CANON_FILE.orbit-tmp-$$"',
  'printf "%s" "$PAYLOAD_B64" | base64 -d > "$TMP" || { rm -f "$TMP" 2>/dev/null || true; echo "__ERR__:WRITE_FAIL"; exit 1; }',
  'mv "$TMP" "$CANON_FILE" || { rm -f "$TMP" 2>/dev/null || true; echo "__ERR__:PERMISSION"; exit 1; }',
  'SIZE=$(wc -c < "$CANON_FILE" | tr -d " ")',
  'MT=$(mtime "$CANON_FILE")',
  'echo "__OK__"',
  'echo "$SIZE"',
  'echo "$MT"',
].join("; ");

function dockerErrorFromText(text: string): never {
  const marker = text.match(/__ERR__:([A-Z_]+)/)?.[1] ?? "";
  if (marker === "ROOT") fail("Project root does not exist", 400);
  if (marker === "NOT_DIR") fail("Not a directory", 400);
  if (marker === "NOT_FILE") fail("Not a file", 404);
  if (marker === "OUTSIDE") fail("Path is outside project root", 400);
  if (marker === "SYMLINK") fail("Symlink operations are not allowed", 400);
  if (marker === "TOO_LARGE")
    fail(
      `File exceeds read limit (${PROJECT_FILES_MAX_READ_BYTES} bytes)`,
      413,
    );
  if (marker === "PARENT") fail("Parent directory does not exist", 400);
  if (marker === "EXISTS_DIR") fail("Cannot overwrite a directory", 400);
  if (marker === "NO_CREATE") fail("File does not exist", 404);
  if (marker === "CONFLICT") fail("File has changed since it was opened", 409);
  if (marker === "PERMISSION")
    fail("Permission denied while writing file", 403);
  if (marker === "WRITE_FAIL") fail("Failed to write file in container", 400);
  fail(text.trim() || "Docker file operation failed", 400);
}

function dockerRelativePath(root: string, absolutePath: string): string {
  const rel = path.posix.relative(root, absolutePath);
  if (!rel || rel === ".") return "";
  if (rel.startsWith("..") || path.posix.isAbsolute(rel)) {
    fail("Path is outside project root", 400);
  }
  return rel;
}

function dockerExecErrorText(error: unknown): string {
  if (typeof error === "object" && error) {
    const stdout =
      "stdout" in error &&
      typeof (error as { stdout?: unknown }).stdout === "string"
        ? (error as { stdout: string }).stdout
        : "";
    const stderr =
      "stderr" in error &&
      typeof (error as { stderr?: unknown }).stderr === "string"
        ? (error as { stderr: string }).stderr
        : "";
    const message = error instanceof Error ? error.message : "";
    return [stdout, stderr, message].filter(Boolean).join("\n");
  }
  return error instanceof Error ? error.message : "Docker command failed";
}

async function dockerExec(
  project: ProjectRecord,
  script: string,
  args: string[],
  options?: DockerExecOptions,
): Promise<string> {
  const container = project.dockerContainer?.trim();
  if (!container)
    fail("dockerContainer is not configured for this project", 400);

  if (project.sshConfigId) {
    if (options?.input != null) {
      fail("Remote Docker write via stdin is not supported", 501);
    }
    if (sshManager.getStatus(project.sshConfigId).state !== "connected") {
      await sshManager.connect(project.sshConfigId);
    }
    const command =
      `docker exec -i ${shellQuote(container)} sh -lc ${shellQuote(script)} sh ` +
      args.map((arg) => shellQuote(arg)).join(" ");
    return sshManager.exec(project.sshConfigId, command);
  }

  const res = await execFileAsync(
    "docker",
    ["exec", "-i", container, "sh", "-lc", script, "sh", ...args],
    {
      maxBuffer: Math.max(PROJECT_FILES_MAX_READ_BYTES * 2, 20_000_000),
      ...(options?.input != null ? { input: options.input } : {}),
    },
  );
  return res.stdout;
}

async function resolveSshExisting(
  sftp: SFTPWrapper,
  rootReal: string,
  relPathRaw: string,
): Promise<{
  relPath: string;
  absPath: string;
  canonicalPath: string;
  attrs: Attributes;
}> {
  const relPath = normalizeSshRelative(relPathRaw);
  const absPath = relPath ? path.posix.join(rootReal, relPath) : rootReal;
  const attrs = await sftpLstat(sftp, absPath).catch(() => {
    fail("Path does not exist", 404);
  });
  if (attrsIsSymlink(attrs)) fail("Symlink operations are not allowed", 400);
  const canonicalPath = await sftpRealpath(sftp, absPath).catch(() => {
    fail("Path is not accessible", 400);
  });
  ensureWithinRootPosix(rootReal, canonicalPath);
  return { relPath, absPath, canonicalPath, attrs };
}

async function resolveSshParentForCreate(
  sftp: SFTPWrapper,
  rootReal: string,
  relPathRaw: string,
): Promise<{
  relPath: string;
  targetAbsPath: string;
}> {
  const relPath = normalizeSshRelative(relPathRaw);
  if (!relPath) fail("Path is required", 400);
  const targetAbsPath = path.posix.join(rootReal, relPath);
  const parentAbsPath = path.posix.dirname(targetAbsPath);
  const parentCanonical = await sftpRealpath(sftp, parentAbsPath).catch(() => {
    fail("Parent directory does not exist", 400);
  });
  ensureWithinRootPosix(rootReal, parentCanonical);
  const parentAttrs = await sftpLstat(sftp, parentAbsPath).catch(() => {
    fail("Parent directory does not exist", 400);
  });
  if (attrsIsSymlink(parentAttrs))
    fail("Symlink operations are not allowed", 400);
  return { relPath, targetAbsPath };
}

function pathByType(project: ProjectRecord): "LOCAL" | "SSH" | "DOCKER" {
  if (project.type === "LOCAL") return "LOCAL";
  if (project.type === "SSH") return "SSH";
  if (project.type === "DOCKER") return "DOCKER";
  fail("File APIs support only LOCAL, SSH, and DOCKER projects", 501);
}

export function fileErrorStatus(error: unknown): number {
  if (error instanceof FileApiError) return error.status;
  return 500;
}

export function fileErrorMessage(error: unknown): string {
  if (error instanceof FileApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unexpected file API error";
}

export async function listProjectFiles(
  project: ProjectRecord,
  rawPath: string,
): Promise<ProjectFileListResponse> {
  const backend = pathByType(project);

  if (backend === "DOCKER") {
    const relPath = normalizeSshRelative(rawPath);
    const stdout = await dockerExec(project, DOCKER_LIST_SCRIPT, [
      project.path,
      relPath,
    ]).catch((error) => {
      dockerErrorFromText(dockerExecErrorText(error));
    });

    const lines = stdout.split("\n").map((line) => line.trimEnd());
    const rootMarker = lines.indexOf("__ROOT__");
    const currentMarker = lines.indexOf("__CURRENT__");
    const entriesMarker = lines.indexOf("__ENTRIES__");
    if (rootMarker === -1 || currentMarker === -1 || entriesMarker === -1) {
      dockerErrorFromText(stdout);
    }

    const root = lines[rootMarker + 1] ?? "";
    const currentAbs = lines[currentMarker + 1] ?? "";
    if (!root || !currentAbs) {
      fail("Failed to parse docker directory listing", 500);
    }

    const current = dockerRelativePath(root, currentAbs);
    const parent = current
      ? current.split("/").slice(0, -1).join("/") || ""
      : null;

    const entries = lines
      .slice(entriesMarker + 1)
      .filter((line) => line.length > 0)
      .map((line) => {
        const [typeCode = "f", name = "", sizeRaw = "", mtimeRaw = ""] =
          line.split("\t");
        const isDir = typeCode === "d";
        const isSymlink = typeCode === "l";
        const pathRel = current ? `${current}/${name}` : name;
        return {
          name,
          path: pathRel,
          isDir,
          isSymlink,
          size: isDir || isSymlink ? null : Number(sizeRaw || 0),
          mtimeMs: mtimeRaw ? Number(mtimeRaw) * 1000 : null,
        } as ProjectFileEntryInfo;
      })
      .filter((entry) => entry.name.length > 0)
      .slice(0, PROJECT_FILES_MAX_ENTRIES)
      .sort(
        (a, b) =>
          Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name),
      );

    return { current, parent, entries };
  }

  if (backend === "LOCAL") {
    const resolved = await resolveLocalExisting(project.path, rawPath);
    if (!resolved.st.isDirectory()) fail("Not a directory", 400);
    const entries = await fs.readdir(resolved.realPath, {
      withFileTypes: true,
    });
    const limited = entries.slice(0, PROJECT_FILES_MAX_ENTRIES);
    const mapped: ProjectFileEntryInfo[] = [];

    for (const entry of limited) {
      const childAbs = path.join(resolved.realPath, entry.name);
      const childLst = await fs.lstat(childAbs).catch(() => null);
      if (!childLst) continue;
      const childIsSymlink = childLst.isSymbolicLink();
      const childIsDir = childLst.isDirectory();
      const relPath = toRelativeFromRoot(resolved.rootReal, childAbs);
      mapped.push({
        name: entry.name,
        path: relPath,
        isDir: childIsDir,
        isSymlink: childIsSymlink,
        size: childIsDir ? null : Number(childLst.size),
        mtimeMs: Number(childLst.mtimeMs),
      });
    }

    mapped.sort(
      (a, b) =>
        Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name),
    );

    const current = toRelativeFromRoot(resolved.rootReal, resolved.realPath);
    const parent = current
      ? current.split("/").slice(0, -1).join("/") || ""
      : null;

    return { current, parent, entries: mapped };
  }

  return withSshRoot(project, async (sftp, rootReal) => {
    const resolved = await resolveSshExisting(sftp, rootReal, rawPath);
    if (!attrsIsDirectory(resolved.attrs)) fail("Not a directory", 400);
    const entries = await sftpReadDir(sftp, resolved.canonicalPath).catch(
      (error) => {
        fromSftpError(error, "Cannot read directory");
      },
    );
    const limited = entries.slice(0, PROJECT_FILES_MAX_ENTRIES);
    const mapped = limited
      .filter((entry) => entry.filename !== "." && entry.filename !== "..")
      .map((entry) => {
        const childCanonical = path.posix.join(
          resolved.canonicalPath,
          entry.filename,
        );
        const relPath = path.posix.relative(rootReal, childCanonical);
        if (relPath.startsWith("..") || path.posix.isAbsolute(relPath)) {
          fail("Path is outside project root", 400);
        }
        return attrsToEntry(entry.filename, relPath || "", entry.attrs);
      })
      .sort(
        (a, b) =>
          Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name),
      );

    const current = path.posix.relative(rootReal, resolved.canonicalPath) || "";
    const parent = current
      ? current.split("/").slice(0, -1).join("/") || ""
      : null;

    return { current, parent, entries: mapped };
  });
}

export async function readProjectFile(
  project: ProjectRecord,
  rawPath: string,
): Promise<ProjectFileReadResponse> {
  const backend = pathByType(project);

  if (backend === "DOCKER") {
    const relPath = normalizeSshRelative(rawPath);
    const stdout = await dockerExec(project, DOCKER_READ_SCRIPT, [
      project.path,
      relPath,
      String(PROJECT_FILES_MAX_READ_BYTES),
    ]).catch((error) => {
      dockerErrorFromText(dockerExecErrorText(error));
    });

    const lines = stdout.split("\n");
    if (lines[0]?.trim() !== "__OK__") {
      dockerErrorFromText(stdout);
    }
    const size = Number((lines[1] ?? "0").trim());
    const mtimeSec = Number((lines[2] ?? "0").trim());
    const b64 = (lines.slice(3).join("\n") ?? "").trim();
    const buffer = Buffer.from(b64, "base64");
    const parsed = bytesToText(buffer);

    return {
      path: relPath,
      content: parsed.content,
      isBinary: parsed.isBinary,
      size,
      mtimeMs: mtimeSec * 1000,
      encoding: parsed.encoding,
    };
  }

  if (backend === "LOCAL") {
    const resolved = await resolveLocalExisting(project.path, rawPath);
    if (!resolved.st.isFile()) fail("Not a file", 400);
    if (resolved.st.size > PROJECT_FILES_MAX_READ_BYTES) {
      fail(
        `File exceeds read limit (${PROJECT_FILES_MAX_READ_BYTES} bytes)`,
        413,
      );
    }

    const buffer = await fs.readFile(resolved.realPath);
    const parsed = bytesToText(buffer);

    return {
      path: resolved.relPath,
      content: parsed.content,
      isBinary: parsed.isBinary,
      size: Number(resolved.st.size),
      mtimeMs: Number(resolved.st.mtimeMs),
      encoding: parsed.encoding,
    };
  }

  return withSshRoot(project, async (sftp, rootReal) => {
    const resolved = await resolveSshExisting(sftp, rootReal, rawPath);
    if (!attrsIsFile(resolved.attrs)) fail("Not a file", 400);
    const size = Number(resolved.attrs.size ?? 0);
    if (size > PROJECT_FILES_MAX_READ_BYTES) {
      fail(
        `File exceeds read limit (${PROJECT_FILES_MAX_READ_BYTES} bytes)`,
        413,
      );
    }

    const buffer = await sftpReadFile(sftp, resolved.canonicalPath).catch(
      (error) => {
        fromSftpError(error, "Failed to read file");
      },
    );
    const parsed = bytesToText(buffer);
    const relPath = path.posix.relative(rootReal, resolved.canonicalPath);

    return {
      path: relPath || "",
      content: parsed.content,
      isBinary: parsed.isBinary,
      size,
      mtimeMs: Number(resolved.attrs.mtime ?? 0) * 1000,
      encoding: parsed.encoding,
    };
  });
}

export async function writeProjectFile(
  project: ProjectRecord,
  rawPath: string,
  body: ProjectFileWriteRequest,
): Promise<ProjectFileWriteResponse> {
  const backend = pathByType(project);
  const content = body.content ?? "";
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > PROJECT_FILES_MAX_EDIT_BYTES) {
    fail(
      `File exceeds edit limit (${PROJECT_FILES_MAX_EDIT_BYTES} bytes)`,
      413,
    );
  }

  if (backend === "DOCKER") {
    const relPath = normalizeSshRelative(rawPath);
    const expectedSec =
      body.expectedMtimeMs != null
        ? String(Math.floor(Number(body.expectedMtimeMs) / 1000))
        : "";
    const allowCreate = body.create === false ? "0" : "1";

    if (project.sshConfigId) {
      const payloadB64 = Buffer.from(content, "utf8").toString("base64");
      if (payloadB64.length > 1_000_000) {
        fail("Remote Docker write payload is too large", 413);
      }
      const stdout = await dockerExec(project, DOCKER_WRITE_B64_SCRIPT, [
        project.path,
        relPath,
        expectedSec,
        allowCreate,
        payloadB64,
      ]).catch((error) => {
        dockerErrorFromText(dockerExecErrorText(error));
      });

      const lines = stdout.split("\n");
      if (lines[0]?.trim() !== "__OK__") {
        dockerErrorFromText(stdout);
      }
      const size = Number((lines[1] ?? "0").trim());
      const mtimeSec = Number((lines[2] ?? "0").trim());
      return { ok: true, mtimeMs: mtimeSec * 1000, size };
    }

    const stdout = await dockerExec(
      project,
      DOCKER_WRITE_STDIN_SCRIPT,
      [project.path, relPath, expectedSec, allowCreate],
      { input: content },
    ).catch((error) => {
      dockerErrorFromText(dockerExecErrorText(error));
    });

    const lines = stdout.split("\n");
    if (lines[0]?.trim() !== "__OK__") {
      dockerErrorFromText(stdout);
    }
    const size = Number((lines[1] ?? "0").trim());
    const mtimeSec = Number((lines[2] ?? "0").trim());
    return { ok: true, mtimeMs: mtimeSec * 1000, size };
  }

  if (backend === "LOCAL") {
    const { targetAbs } = await resolveLocalParentForCreate(
      project.path,
      rawPath,
    );
    const existingLst = await fs.lstat(targetAbs).catch(() => null);
    if (existingLst?.isSymbolicLink())
      fail("Symlink operations are not allowed", 400);

    if (existingLst && existingLst.isDirectory())
      fail("Cannot overwrite a directory", 400);
    if (!existingLst && body.create === false) fail("File does not exist", 404);

    if (existingLst && body.expectedMtimeMs != null) {
      const currentMtimeMs = Number(existingLst.mtimeMs);
      if (currentMtimeMs !== Number(body.expectedMtimeMs)) {
        fail("File has changed since it was opened", 409);
      }
    }

    const tmpPath = `${targetAbs}.orbit-tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try {
      await fs.writeFile(tmpPath, content, "utf8");
      await fs.rename(tmpPath, targetAbs);
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";

      await fs.unlink(tmpPath).catch(() => undefined);

      const isPermissionError = code === "EACCES" || code === "EPERM";
      if (isPermissionError) {
        if (existingLst && existingLst.isFile()) {
          await fs
            .writeFile(targetAbs, content, "utf8")
            .catch((directError) => {
              const directCode =
                typeof directError === "object" &&
                directError &&
                "code" in directError
                  ? String((directError as { code?: unknown }).code)
                  : "";
              if (directCode === "EACCES" || directCode === "EPERM") {
                fail("Permission denied while writing file", 403);
              }
              throw directError;
            });
        } else {
          fail("Permission denied while creating file", 403);
        }
      } else {
        throw error;
      }
    }
    const nextStat = await fs.stat(targetAbs);

    return {
      ok: true,
      mtimeMs: Number(nextStat.mtimeMs),
      size: Number(nextStat.size),
    };
  }

  return withSshRoot(project, async (sftp, rootReal) => {
    const { targetAbsPath } = await resolveSshParentForCreate(
      sftp,
      rootReal,
      rawPath,
    );
    const existingAttrs = await sftpLstat(sftp, targetAbsPath).catch(
      () => null,
    );
    if (existingAttrs && attrsIsSymlink(existingAttrs))
      fail("Symlink operations are not allowed", 400);
    if (existingAttrs && attrsIsDirectory(existingAttrs))
      fail("Cannot overwrite a directory", 400);
    if (!existingAttrs && body.create === false)
      fail("File does not exist", 404);

    if (existingAttrs && body.expectedMtimeMs != null) {
      const currentMtimeMs = Number(existingAttrs.mtime ?? 0) * 1000;
      if (currentMtimeMs !== Number(body.expectedMtimeMs)) {
        fail("File has changed since it was opened", 409);
      }
    }

    const tmpPath = `${targetAbsPath}.orbit-tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const data = Buffer.from(content, "utf8");
    await sftpWriteFile(sftp, tmpPath, data).catch((error) => {
      fromSftpError(error, "Failed to write file");
    });
    await sftpRename(sftp, tmpPath, targetAbsPath).catch((error) => {
      fromSftpError(error, "Failed to finalize file write");
    });
    const nextAttrs = await sftpStat(sftp, targetAbsPath).catch((error) => {
      fromSftpError(error, "Failed to stat file after write");
    });

    return {
      ok: true,
      mtimeMs: Number(nextAttrs.mtime ?? 0) * 1000,
      size: Number(nextAttrs.size ?? bytes),
    };
  });
}

export async function mkdirProjectPath(
  project: ProjectRecord,
  rawPath: string,
): Promise<{ ok: true }> {
  const backend = pathByType(project);

  if (backend === "DOCKER") {
    fail("DOCKER mkdir is not supported yet", 501);
  }

  if (backend === "LOCAL") {
    const { targetAbs } = await resolveLocalParentForCreate(
      project.path,
      rawPath,
    );
    const existing = await fs.lstat(targetAbs).catch(() => null);
    if (existing) fail("Path already exists", 409);
    await fs.mkdir(targetAbs);
    return { ok: true };
  }

  return withSshRoot(project, async (sftp, rootReal) => {
    const { targetAbsPath } = await resolveSshParentForCreate(
      sftp,
      rootReal,
      rawPath,
    );
    const existing = await sftpLstat(sftp, targetAbsPath).catch(() => null);
    if (existing) fail("Path already exists", 409);
    await sftpMkdir(sftp, targetAbsPath).catch((error) => {
      fromSftpError(error, "Failed to create directory");
    });
    return { ok: true };
  });
}

export async function renameProjectPath(
  project: ProjectRecord,
  body: ProjectFileRenameRequest,
): Promise<{ ok: true }> {
  const backend = pathByType(project);
  const fromRel = normalizeRelativePath(body.from);
  const toRel = normalizeRelativePath(body.to);
  if (!fromRel || !toRel) fail("Both from and to paths are required", 400);

  if (backend === "DOCKER") {
    fail("DOCKER rename is not supported yet", 501);
  }

  if (backend === "LOCAL") {
    const fromResolved = await resolveLocalExisting(project.path, fromRel);
    const { targetAbs: toAbs } = await resolveLocalParentForCreate(
      project.path,
      toRel,
    );
    const toExisting = await fs.lstat(toAbs).catch(() => null);
    if (toExisting) fail("Destination already exists", 409);
    await fs.rename(fromResolved.absPath, toAbs);
    return { ok: true };
  }

  return withSshRoot(project, async (sftp, rootReal) => {
    const fromResolved = await resolveSshExisting(sftp, rootReal, fromRel);
    const { targetAbsPath: toAbs } = await resolveSshParentForCreate(
      sftp,
      rootReal,
      toRel,
    );
    const toExisting = await sftpLstat(sftp, toAbs).catch(() => null);
    if (toExisting) fail("Destination already exists", 409);
    await sftpRename(sftp, fromResolved.absPath, toAbs).catch((error) => {
      fromSftpError(error, "Failed to rename path");
    });
    return { ok: true };
  });
}

export async function deleteProjectPath(
  project: ProjectRecord,
  body: ProjectFileDeleteRequest,
): Promise<{ ok: true }> {
  const backend = pathByType(project);
  const targetRel = normalizeRelativePath(body.path);
  if (!targetRel) fail("Path is required", 400);

  if (backend === "DOCKER") {
    fail("DOCKER delete is not supported yet", 501);
  }

  if (backend === "LOCAL") {
    const resolved = await resolveLocalExisting(project.path, targetRel);
    if (resolved.st.isDirectory()) {
      if (!body.recursive)
        fail("Directory delete requires recursive=true", 400);
      await fs.rm(resolved.absPath, { recursive: true, force: false });
      return { ok: true };
    }
    await fs.unlink(resolved.absPath);
    return { ok: true };
  }

  return withSshRoot(project, async (sftp, rootReal) => {
    const resolved = await resolveSshExisting(sftp, rootReal, targetRel);
    if (attrsIsDirectory(resolved.attrs)) {
      if (!body.recursive)
        fail("Directory delete requires recursive=true", 400);
      await sftpDeleteRecursive(sftp, resolved.absPath);
      return { ok: true };
    }
    await sftpUnlink(sftp, resolved.absPath).catch((error) => {
      fromSftpError(error, "Failed to delete file");
    });
    return { ok: true };
  });
}
