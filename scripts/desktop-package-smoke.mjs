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
const remoteBuilderConfig = "electron-builder.remote.yml";
const localBuilderConfig = "electron-builder.local.yml";

const checks = [
  {
    id: "no-fake-desktop-pack",
    label: "generic desktop:pack is absent from the remote-only package phase",
    pass:
      typeof scripts["desktop:pack"] !== "string" &&
      typeof scripts["desktop:pack:remote"] === "string",
    gap: "Do not expose desktop:pack until the generic packaged profile is actually supported; use desktop:pack:remote first.",
  },
  {
    id: "remote-packager-configured",
    label: "remote packaging has a real electron-builder config and build step",
    pass:
      Boolean(deps["electron-builder"]) &&
      scripts["desktop:electron-build"] ===
        "node scripts/desktop-electron-build.mjs" &&
      /desktop:electron-build/.test(scripts["desktop:pack:remote"] ?? "") &&
      /desktop:electron-build/.test(scripts["desktop:pack:remote:zip"] ?? "") &&
      /electron-builder --mac dir --arm64 --config electron-builder\.remote\.yml/.test(
        scripts["desktop:pack:remote"] ?? "",
      ) &&
      /electron-builder --mac zip --arm64 --config electron-builder\.remote\.yml/.test(
        scripts["desktop:pack:remote:zip"] ?? "",
      ) &&
      exists(remoteBuilderConfig) &&
      exists(localBuilderConfig) &&
      exists("tsconfig.electron-build.json") &&
      exists("scripts/desktop-electron-build.mjs") &&
      scripts["desktop:local-server-build"] ===
        "node scripts/desktop-local-server-build.mjs" &&
      scripts["desktop:rebuild:local-native"] ===
        "node scripts/desktop-rebuild-local-native.mjs" &&
      /desktop:local-server-build/.test(scripts["desktop:pack:local"] ?? "") &&
      /desktop:rebuild:local-native/.test(
        scripts["desktop:pack:local"] ?? "",
      ) &&
      /electron-builder --mac dir --arm64 --config electron-builder\.local\.yml/.test(
        scripts["desktop:pack:local"] ?? "",
      ),
    gap: "Add electron-builder, desktop Electron/server build scripts, remote/local package scripts, and builder configs.",
  },
  {
    id: "remote-builder-is-narrow",
    label: "remote builder config packages only compiled Electron shell assets",
    pass:
      has(remoteBuilderConfig, /target:\s*dir/) &&
      has(remoteBuilderConfig, /identity:\s*null/) &&
      has(remoteBuilderConfig, /icon:\s*assets\/desktop\/orbit-icon\.png/) &&
      exists("assets/desktop/orbit-icon.png") &&
      has(remoteBuilderConfig, /npmRebuild:\s*false/) &&
      has(remoteBuilderConfig, /app:\s*dist-electron/) &&
      has(remoteBuilderConfig, /files:[\s\S]*"\*\*\/\*"/) &&
      has(remoteBuilderConfig, /!node_modules\/\*\*/) &&
      has("scripts/desktop-electron-build.mjs", /main:\s*"main\.js"/) &&
      !has(remoteBuilderConfig, /node-pty/) &&
      !has(
        remoteBuilderConfig,
        /query-engine|prisma\/schema\.prisma|server\/server\.js/,
      ),
    gap: "Keep the first packaged profile unsigned, dir-targeted, native-rebuild-free, and limited to dist-electron shell files.",
  },
  {
    id: "local-builder-includes-runtime",
    label: "local builder config includes packaged server runtime assets",
    pass:
      has(localBuilderConfig, /dist-electron\/\*\*\/\*/) &&
      has(localBuilderConfig, /dist\/\*\*\/\*/) &&
      has(localBuilderConfig, /\.next\/\*\*\/\*/) &&
      has(localBuilderConfig, /scripts\/desktop-db-bootstrap\.mjs/) &&
      has(localBuilderConfig, /prisma\/schema\.prisma/) &&
      has(
        localBuilderConfig,
        /extraMetadata:[\s\S]*main:\s*dist-electron\/main\.js/,
      ) &&
      has(localBuilderConfig, /asar:\s*false/) &&
      has(localBuilderConfig, /npmRebuild:\s*false/) &&
      has("scripts/desktop-rebuild-local-native.mjs", /electron-rebuild/) &&
      has("scripts/desktop-rebuild-local-native.mjs", /"-o"/) &&
      has("scripts/desktop-rebuild-local-native.mjs", /node-pty/) &&
      has("scripts/desktop-local-server-build.mjs", /dist\/node_modules\/@/) &&
      has("scripts/desktop-local-server-build.mjs", /dist\/src\/server/) &&
      has("scripts/desktop-local-server-build.mjs", /dist\/src\/lib/),
    gap: "Package compiled server, Next output, DB bootstrap, Prisma schema, explicit main, unpacked app resources, and @ alias shims for local mode.",
  },
  {
    id: "package-smoke-script",
    label: "desktop:package-smoke is wired to this audit script",
    pass:
      scripts["desktop:package-smoke"] ===
        "node scripts/desktop-package-smoke.mjs" &&
      /desktop:package-smoke/.test(scripts["desktop:build"] ?? "") &&
      /desktop:build/.test(scripts["desktop:pack:remote"] ?? "") &&
      /desktop:build/.test(scripts["desktop:pack:remote:zip"] ?? "") &&
      /desktop:build/.test(scripts["desktop:pack:local"] ?? ""),
    gap: "Wire desktop:package-smoke into desktop:build and require package scripts to run the desktop build chain.",
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
      has("electron/serverSupervisor.ts", /dist.*server\.js/s) &&
      has("electron/serverSupervisor.ts", /NODE_PATH/) &&
      has(
        "scripts/desktop-db-bootstrap.mjs",
        /node_modules.*prisma.*build.*index\.js/s,
      ),
    gap: "Make the preview-vs-packaged server entry boundary explicit in serverSupervisor.ts.",
  },
  {
    id: "packaged-mode-ux-boundary",
    label: "packaged app blocks unavailable modes based on runtime assets",
    pass:
      has("electron/main.ts", /isRemoteOnlyPackagedApp/) &&
      has("electron/main.ts", /hasPackagedLocalRuntime/) &&
      has("electron/main.ts", /local-runtime/) &&
      has("electron/main.ts", /PACKAGED_REMOTE_ONLY/) &&
      has("electron/main.ts", /orbit-desktop:capabilities/) &&
      has("electron/preload.cjs", /getCapabilities/) &&
      has("electron/connection.html", /kindEnabled/) &&
      has("electron/connection.html", /activateKind/) &&
      has("electron/connection.html", /profileAvailable/) &&
      has("electron/connection.html", /Remote URL packaged preview/),
    gap: "Expose capabilities IPC and disable This Mac/SSH in the packaged remote app instead of letting them fail at runtime.",
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
