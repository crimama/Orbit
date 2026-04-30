import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { assertValidAutoPort, assertValidPort, validateRemoteOrbitUrl } from "./urlValidation";

export type LocalConnectionProfile = {
  id: string;
  kind: "local";
  name: string;
  port: "auto" | number;
  dataDir?: string;
};

export type RemoteConnectionProfile = {
  id: string;
  kind: "remote";
  name: string;
  url: string;
};

export type SshTunnelConnectionProfile = {
  id: string;
  kind: "ssh-tunnel";
  name: string;
  sshHost: string;
  sshPort: number;
  sshUsername: string;
  remoteOrbitPort: number;
  localPort: "auto" | number;
  privateKeyPath?: string;
};

export type OrbitDesktopConnectionProfile =
  | LocalConnectionProfile
  | RemoteConnectionProfile
  | SshTunnelConnectionProfile;

export type ProfileStoreData = {
  version: 1;
  profiles: OrbitDesktopConnectionProfile[];
  lastProfileId?: string;
};

const DEFAULT_STORE: ProfileStoreData = { version: 1, profiles: [] };
const FORBIDDEN_SECRET_KEYS = /(password|passphrase|secret|token)/i;

export function defaultProfileStorePath(userDataPath: string): string {
  return join(userDataPath, "connection-profiles.json");
}

export function createLocalProfile(input: Partial<LocalConnectionProfile> & { name?: string } = {}): LocalConnectionProfile {
  return sanitizeProfile({
    id: input.id ?? randomUUID(),
    kind: "local",
    name: input.name ?? "This Mac",
    port: input.port ?? "auto",
    dataDir: input.dataDir,
  }) as LocalConnectionProfile;
}

export function sanitizeProfile(profile: unknown): OrbitDesktopConnectionProfile {
  assertNoPlaintextSecrets(profile);
  if (!isRecord(profile)) throw new Error("Profile must be an object");

  const base = {
    id: requireNonEmptyString(profile.id, "profile.id"),
    name: requireNonEmptyString(profile.name, "profile.name"),
  };

  switch (profile.kind) {
    case "local":
      return omitUndefined({
        ...base,
        kind: "local",
        port: assertValidAutoPort(profile.port, "profile.port"),
        dataDir: optionalNonEmptyString(profile.dataDir, "profile.dataDir"),
      });
    case "remote": {
      const validated = validateRemoteOrbitUrl(requireNonEmptyString(profile.url, "profile.url"));
      if (!validated.ok) throw new Error(validated.error);
      return omitUndefined({
        ...base,
        kind: "remote",
        url: validated.normalizedUrl,
      });
    }
    case "ssh-tunnel":
      return omitUndefined({
        ...base,
        kind: "ssh-tunnel",
        sshHost: validateSshHost(requireNonEmptyString(profile.sshHost, "profile.sshHost")),
        sshPort: assertValidPort(profile.sshPort, "profile.sshPort"),
        sshUsername: validateSshUsername(requireNonEmptyString(profile.sshUsername, "profile.sshUsername")),
        remoteOrbitPort: assertValidPort(profile.remoteOrbitPort, "profile.remoteOrbitPort"),
        localPort: assertValidAutoPort(profile.localPort, "profile.localPort"),
        privateKeyPath: optionalNonEmptyString(profile.privateKeyPath, "profile.privateKeyPath"),
      });
    default:
      throw new Error("Unsupported profile kind");
  }
}

export async function loadProfileStore(filePath: string): Promise<ProfileStoreData> {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    return sanitizeStore(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ...DEFAULT_STORE };
    throw error;
  }
}

export async function saveProfileStore(filePath: string, data: ProfileStoreData): Promise<void> {
  const sanitized = sanitizeStore(data);
  await mkdir(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(sanitized, null, 2)}\n`, { mode: 0o600 });
  await rename(tempPath, filePath);
}

export async function upsertProfile(
  filePath: string,
  profile: OrbitDesktopConnectionProfile,
): Promise<ProfileStoreData> {
  const store = await loadProfileStore(filePath);
  const sanitized = sanitizeProfile(profile);
  const existingIndex = store.profiles.findIndex((item) => item.id === sanitized.id);
  const profiles = [...store.profiles];
  if (existingIndex >= 0) profiles[existingIndex] = sanitized;
  else profiles.push(sanitized);
  const next = { ...store, profiles, lastProfileId: sanitized.id };
  await saveProfileStore(filePath, next);
  return next;
}

function sanitizeStore(data: unknown): ProfileStoreData {
  assertNoPlaintextSecrets(data);
  if (!isRecord(data)) return { ...DEFAULT_STORE };
  if (data.version !== 1) throw new Error("Unsupported profile store version");
  if (!Array.isArray(data.profiles)) throw new Error("Profile store profiles must be an array");
  const profiles = data.profiles.map(sanitizeProfile);
  const ids = new Set<string>();
  for (const profile of profiles) {
    if (ids.has(profile.id)) throw new Error(`Duplicate profile id: ${profile.id}`);
    ids.add(profile.id);
  }
  const lastProfileId = optionalNonEmptyString(data.lastProfileId, "lastProfileId");
  if (lastProfileId && !ids.has(lastProfileId)) throw new Error("lastProfileId does not reference a stored profile");
  return omitUndefined({ version: 1, profiles, lastProfileId });
}

function assertNoPlaintextSecrets(value: unknown, path = "profile"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPlaintextSecrets(item, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_SECRET_KEYS.test(key)) {
      throw new Error(`Plaintext secret field is not allowed in profile storage: ${path}.${key}`);
    }
    assertNoPlaintextSecrets(nested, `${path}.${key}`);
  }
}

function validateSshHost(host: string): string {
  if (!/^[A-Za-z0-9.-]+$/.test(host) || host.startsWith("-") || host.includes("..")) {
    throw new Error("SSH host must be a hostname or address without shell metacharacters");
  }
  return host;
}

function validateSshUsername(username: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(username) || username.startsWith("-")) {
    throw new Error("SSH username contains unsupported characters");
  }
  return username;
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} is required`);
  return value.trim();
}

function optionalNonEmptyString(value: unknown, label: string): string | undefined {
  if (value == null) return undefined;
  return requireNonEmptyString(value, label);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
