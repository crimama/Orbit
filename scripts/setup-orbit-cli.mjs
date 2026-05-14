#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const orbitBin = join(root, "bin", "orbit.mjs");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function log(message) {
  console.log(`[orbit setup] ${message}`);
}

function warn(message) {
  console.warn(`[orbit setup] ${message}`);
}

function npmGlobalPrefix() {
  const configured = process.env.npm_config_prefix?.trim();
  if (configured) return configured;

  const result = spawnSync(npmCommand, ["prefix", "-g"], {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function sameTarget(linkPath, targetPath) {
  try {
    return resolve(dirname(linkPath), readlinkSync(linkPath)) === targetPath;
  } catch {
    return false;
  }
}

function pathContains(dir) {
  const pathValue = process.env.PATH ?? "";
  const separator = process.platform === "win32" ? ";" : ":";
  return pathValue.split(separator).some((item) => resolve(item) === dir);
}

function setupUnixSymlink(binDir) {
  const linkPath = join(binDir, "orbit");

  mkdirSync(binDir, { recursive: true });
  chmodSync(orbitBin, 0o755);

  if (existsSync(linkPath)) {
    const stat = lstatSync(linkPath);
    if (stat.isSymbolicLink() && sameTarget(linkPath, orbitBin)) {
      log(`orbit command already linked at ${linkPath}`);
      return;
    }
    if (stat.isSymbolicLink()) {
      unlinkSync(linkPath);
    } else {
      warn(`not overwriting existing non-symlink: ${linkPath}`);
      warn("run `npm link` manually if you want to replace it");
      return;
    }
  }

  symlinkSync(orbitBin, linkPath);
  log(`orbit command linked at ${linkPath}`);
}

function main() {
  if (process.env.ORBIT_SKIP_CLI_LINK === "1") {
    log("skipping CLI link because ORBIT_SKIP_CLI_LINK=1");
    return;
  }

  if (!existsSync(orbitBin)) {
    warn(`missing CLI entrypoint: ${orbitBin}`);
    return;
  }

  if (process.env.npm_config_global === "true") {
    log("global install detected; npm will install the orbit bin");
    return;
  }

  const prefix = npmGlobalPrefix();
  if (!prefix) {
    warn("could not resolve npm global prefix; run `npm link` manually");
    return;
  }

  const binDir = process.platform === "win32" ? prefix : join(prefix, "bin");

  if (process.platform === "win32") {
    warn(
      "automatic Windows shim creation is not supported yet; run `npm link` manually",
    );
    return;
  }

  try {
    setupUnixSymlink(binDir);
    if (!pathContains(binDir)) {
      warn(`${binDir} is not in PATH; add it to your shell profile`);
    }
  } catch (error) {
    warn(error instanceof Error ? error.message : String(error));
    warn("run `npm link` manually if automatic CLI linking failed");
  }
}

main();
