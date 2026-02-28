import { promises as fs } from "fs";
import os from "os";
import path from "path";

interface ProjectRegistryEntry {
  projectId: string;
  name: string;
  type: string;
  path: string;
  updatedAt: string;
}

interface ProjectRegistryFile {
  version: number;
  updatedAt: string;
  projects: ProjectRegistryEntry[];
}

const REGISTRY_DIR = path.join(os.homedir(), ".orbit");
const REGISTRY_PATH = path.join(REGISTRY_DIR, "registry.json");

function defaultRegistry(): ProjectRegistryFile {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    projects: [],
  };
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(REGISTRY_DIR, { recursive: true });
}

async function readRegistry(): Promise<ProjectRegistryFile> {
  try {
    const raw = await fs.readFile(REGISTRY_PATH, "utf8");
    const parsed = JSON.parse(raw) as ProjectRegistryFile;
    if (!Array.isArray(parsed.projects)) {
      return defaultRegistry();
    }
    return parsed;
  } catch {
    return defaultRegistry();
  }
}

async function writeRegistry(file: ProjectRegistryFile): Promise<void> {
  await ensureDir();
  const next: ProjectRegistryFile = {
    ...file,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(REGISTRY_PATH, JSON.stringify(next, null, 2), "utf8");
}

export async function registerProject(entry: {
  projectId: string;
  name: string;
  type: string;
  path: string;
}): Promise<void> {
  const file = await readRegistry();
  const now = new Date().toISOString();
  const nextEntry: ProjectRegistryEntry = {
    ...entry,
    updatedAt: now,
  };
  const filtered = file.projects.filter((p) => p.projectId !== entry.projectId);
  filtered.push(nextEntry);
  await writeRegistry({
    ...file,
    projects: filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  });
}

export async function unregisterProject(projectId: string): Promise<void> {
  const file = await readRegistry();
  await writeRegistry({
    ...file,
    projects: file.projects.filter((p) => p.projectId !== projectId),
  });
}

export async function listRegisteredProjects(): Promise<
  ProjectRegistryEntry[]
> {
  const file = await readRegistry();
  return file.projects;
}

export function getProjectRegistryPath(): string {
  return REGISTRY_PATH;
}
