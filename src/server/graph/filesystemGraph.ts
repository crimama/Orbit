import { promises as fs } from "fs";
import path from "path";
import type { GraphState, SkillEdgeInfo, SkillNodeInfo } from "@/lib/types";

const MARKDOWN_EXT = ".md";

const COLUMN_ORDER = [
  "index",
  "decisions",
  "features",
  "bugfix",
  "refactor",
  "devops",
  "other",
] as const;

function mapNodeType(group: string): string {
  if (group === "decisions") return "agent";
  if (group === "features") return "tool";
  if (group === "bugfix" || group === "refactor" || group === "devops") {
    return "mcp";
  }
  return "default";
}

function normalizeRel(relPath: string): string {
  return relPath.split(path.sep).join("/");
}

async function existsDir(dir: string): Promise<boolean> {
  try {
    const st = await fs.stat(dir);
    return st.isDirectory();
  } catch {
    return false;
  }
}

async function collectMarkdownFiles(root: string, dir = root): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(root, abs)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(MARKDOWN_EXT)) {
      files.push(abs);
    }
  }

  return files;
}

function extractTitle(content: string, fallback: string): string {
  const titleLine = content
    .split("\n")
    .find((line) => line.trimStart().startsWith("# "));
  if (!titleLine) return fallback;
  return titleLine.replace(/^#\s+/, "").trim() || fallback;
}

function extractKeywords(content: string): string[] {
  const line = content
    .split("\n")
    .find((v) => /\*\*keywords\*\*\s*:/i.test(v));
  if (!line) return [];
  const raw = line.replace(/^.*\*\*keywords\*\*\s*:\s*/i, "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function extractLinks(content: string): string[] {
  const links: string[] = [];
  const regex = /\[[^\]]+\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null = regex.exec(content);
  while (match) {
    const href = match[1]?.trim();
    if (href && href.endsWith(MARKDOWN_EXT) && !href.includes("://")) {
      links.push(href);
    }
    match = regex.exec(content);
  }
  return links;
}

function resolveSkillGraphRoot(projectPath: string): string {
  const base = path.isAbsolute(projectPath)
    ? projectPath
    : path.resolve(process.cwd(), projectPath);
  return path.join(base, "skill_graph");
}

export async function loadFilesystemGraph(
  projectId: string,
  projectPath: string,
): Promise<GraphState | null> {
  const skillGraphRoot = resolveSkillGraphRoot(projectPath);
  if (!(await existsDir(skillGraphRoot))) {
    return null;
  }

  const absFiles = await collectMarkdownFiles(skillGraphRoot);
  if (absFiles.length === 0) return null;

  const nodeMap = new Map<
    string,
    {
      rel: string;
      abs: string;
      group: string;
      title: string;
      keywords: string[];
      links: string[];
      createdAt: string;
      updatedAt: string;
    }
  >();

  for (const abs of absFiles) {
    const rel = normalizeRel(path.relative(skillGraphRoot, abs));
    const base = path.basename(rel, MARKDOWN_EXT);
    const group = rel.includes("/") ? rel.split("/")[0] : "index";
    const [content, stat] = await Promise.all([
      fs.readFile(abs, "utf8"),
      fs.stat(abs),
    ]);
    nodeMap.set(rel, {
      rel,
      abs,
      group,
      title: extractTitle(content, base),
      keywords: extractKeywords(content),
      links: extractLinks(content),
      createdAt: stat.birthtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
    });
  }

  const grouped = new Map<string, string[]>();
  for (const rel of Array.from(nodeMap.keys()).sort()) {
    const group = nodeMap.get(rel)?.group ?? "other";
    const key = COLUMN_ORDER.includes(group as (typeof COLUMN_ORDER)[number])
      ? group
      : "other";
    const arr = grouped.get(key) ?? [];
    arr.push(rel);
    grouped.set(key, arr);
  }

  const nodes: SkillNodeInfo[] = [];
  const colGap = 300;
  const rowGap = 170;

  for (let col = 0; col < COLUMN_ORDER.length; col++) {
    const group = COLUMN_ORDER[col];
    const rels = grouped.get(group) ?? [];
    for (let row = 0; row < rels.length; row++) {
      const rel = rels[row];
      const entry = nodeMap.get(rel);
      if (!entry) continue;
      const desc =
        entry.keywords.length > 0
          ? `[${entry.group}] ${entry.keywords.join(", ")}`
          : `[${entry.group}] ${rel}`;
      nodes.push({
        id: `fs:${rel}`,
        projectId,
        name: entry.title,
        description: desc,
        mcpEndpoint: rel,
        config: JSON.stringify({
          source: "skill_graph",
          path: entry.abs,
          relPath: rel,
          keywords: entry.keywords,
        }),
        posX: col * colGap,
        posY: row * rowGap,
        nodeType: mapNodeType(entry.group),
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      });
    }
  }

  const edges: SkillEdgeInfo[] = [];
  const seen = new Set<string>();
  for (const [sourceRel, source] of Array.from(nodeMap.entries())) {
    for (const href of source.links) {
      const targetRel = normalizeRel(
        path.normalize(path.join(path.dirname(sourceRel), href)),
      );
      if (!nodeMap.has(targetRel)) continue;
      const edgeKey = `${sourceRel}->${targetRel}`;
      if (seen.has(edgeKey)) continue;
      seen.add(edgeKey);
      edges.push({
        id: `fs-edge:${edgeKey}`,
        sourceId: `fs:${sourceRel}`,
        targetId: `fs:${targetRel}`,
        label: "ref",
        animated: false,
        createdAt: source.createdAt,
      });
    }
  }

  return {
    projectId,
    nodes,
    edges,
    readOnly: true,
    source: "skill_graph_fs",
  };
}

export async function hasFilesystemGraph(): Promise<boolean> {
  return existsDir(path.join(process.cwd(), "skill_graph"));
}
