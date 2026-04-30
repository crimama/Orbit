import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface OrbitDesktopPaths {
  appDataDir: string;
  databaseUrl: string;
  databasePath: string;
}

const appDataEnv = "ORBIT_DESKTOP_APP_DATA_DIR";
const defaultAppName = "Orbit";

export function getOrbitDesktopAppDataDir(appName = defaultAppName): string {
  const explicit = process.env[appDataEnv]?.trim();
  if (explicit) return explicit;

  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", appName);
  }

  const xdgDataHome = process.env.XDG_DATA_HOME?.trim();
  if (xdgDataHome) return join(xdgDataHome, appName);

  if (process.platform === "win32") {
    const appData = process.env.APPDATA?.trim();
    if (appData) return join(appData, appName);
  }

  return join(homedir(), ".orbit-desktop");
}

export function ensureOrbitDesktopPaths(appName = defaultAppName): OrbitDesktopPaths {
  const appDataDir = getOrbitDesktopAppDataDir(appName);
  if (!existsSync(appDataDir)) mkdirSync(appDataDir, { recursive: true });

  const databasePath = join(appDataDir, "orbit.db");
  return {
    appDataDir,
    databasePath,
    databaseUrl: `file:${databasePath}`,
  };
}
