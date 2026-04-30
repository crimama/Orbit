#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function exists(relativePath) {
  return existsSync(join(root, relativePath));
}

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function has(relativePath, pattern) {
  return exists(relativePath) && pattern.test(read(relativePath));
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

const pkg = readJson("package.json");
const scripts = pkg.scripts ?? {};
const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

const packagingDoc = "docs/orbit-mac-packaging-design.md";
const electronDesignDoc = "docs/orbit-mac-electron-design.md";

const checks = [
  {
    id: "no-fake-desktop-pack",
    label: "desktop:pack is absent unless a real packager is configured",
    pass:
      typeof scripts["desktop:pack"] !== "string" ||
      Boolean(deps["electron-builder"] || deps["@electron-forge/cli"]),
    gap: "Do not expose desktop:pack until a real packager dependency and config are present.",
  },
  {
    id: "package-smoke-script",
    label: "desktop:package-smoke is wired to this audit script",
    pass:
      scripts["desktop:package-smoke"] ===
        "node scripts/desktop-package-smoke.mjs" &&
      /desktop:package-smoke/.test(scripts["desktop:build"] ?? ""),
    gap: "Wire desktop:package-smoke into the deterministic desktop build chain.",
  },
  {
    id: "packaging-design-doc",
    label: "packaging design doc records current and future boundaries",
    pass:
      has(packagingDoc, /desktop:dev/) &&
      has(packagingDoc, /desktop:preview/) &&
      has(packagingDoc, /desktop:pack/) &&
      has(packagingDoc, /notarization/i) &&
      has(packagingDoc, /Linux CI/i),
    gap: "Add packaging design documentation that separates preview validation from real macOS packaging.",
  },
  {
    id: "native-and-prisma-assets",
    label:
      "packaging doc names native rebuild and Prisma artifact requirements",
    pass:
      has(packagingDoc, /node-pty/) &&
      has(packagingDoc, /Electron ABI/) &&
      has(packagingDoc, /Prisma/) &&
      has(packagingDoc, /query engine/i),
    gap: "Document node-pty rebuild and Prisma client/query-engine placement before packaging claims.",
  },
  {
    id: "runtime-boundary-code",
    label:
      "server supervisor has explicit repo-preview and packaged-resources modes",
    pass:
      has("electron/serverSupervisor.ts", /repo-preview/) &&
      has("electron/serverSupervisor.ts", /packaged-resources/) &&
      has("electron/serverSupervisor.ts", /ORBIT_DESKTOP_SERVER_RUNTIME/) &&
      has("electron/serverSupervisor.ts", /resources.*server.*server\.js/s),
    gap: "Make the preview-vs-packaged server entry boundary explicit in serverSupervisor.ts.",
  },
  {
    id: "preview-runtime-safety",
    label:
      "preview runtime still uses app data DB bootstrap and loopback desktop env",
    pass:
      has("electron/serverSupervisor.ts", /ORBIT_DESKTOP_LOCAL/) &&
      has(
        "electron/serverSupervisor.ts",
        /DATABASE_URL:\s*paths\.databaseUrl/,
      ) &&
      has("electron/serverSupervisor.ts", /desktop-db-bootstrap/) &&
      has("electron/serverSupervisor.ts", /127\.0\.0\.1/),
    gap: "Preserve app-data DATABASE_URL, DB bootstrap, and loopback-only local server behavior.",
  },
  {
    id: "no-notarization-claim",
    label: "docs do not claim notarized packaging from this Linux pass",
    pass:
      has(packagingDoc, /cannot verify[\s\S]*notarization/i) &&
      has(packagingDoc, /not active/i) &&
      !Object.entries(scripts).some(
        ([name, value]) => /notar/i.test(name) || /notar/i.test(String(value)),
      ),
    gap: "Keep notarization as follow-up until signed/notarized artifacts are produced and verified.",
  },
  {
    id: "design-cross-link",
    label: "main Electron design links to packaging design",
    pass: has(electronDesignDoc, /orbit-mac-packaging-design\.md/),
    gap: "Cross-link the packaging design from the main Electron design document.",
  },
];

const failures = checks.filter((check) => !check.pass);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.id}: ${check.label}`);
  if (!check.pass) console.log(`  gap: ${check.gap}`);
}

console.log(
  `\nDesktop package smoke summary: ${checks.length - failures.length}/${checks.length} passed`,
);

if (failures.length) {
  console.log("\nConcrete gaps:");
  for (const failure of failures) {
    console.log(`- ${failure.id}: ${failure.gap}`);
  }
  process.exit(1);
}
