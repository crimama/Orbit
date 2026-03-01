import { promises as fs, readFileSync } from "fs";
import os from "os";
import path from "path";

function tokenFilePath(): string {
  const fromEnv = process.env.ORBIT_ACCESS_TOKEN_FILE?.trim();
  if (fromEnv) return fromEnv;
  return path.join(os.homedir(), ".orbit", "access-token");
}

function sanitize(value: string): string {
  return value.replace(/[\r\n]/g, "").trim();
}

export function readPersistedAccessTokenSync(): string {
  const filePath = tokenFilePath();
  try {
    return sanitize(readFileSync(filePath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`[Auth] Failed to read access token file ${filePath}`);
    }
    return "";
  }
}

export async function readPersistedAccessToken(): Promise<string> {
  const filePath = tokenFilePath();
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return sanitize(raw);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`[Auth] Failed to read access token file ${filePath}`);
    }
    return "";
  }
}

export async function writePersistedAccessToken(token: string): Promise<void> {
  const value = sanitize(token);
  if (!value) {
    throw new Error("Access token cannot be empty");
  }

  const filePath = tokenFilePath();
  const dirPath = path.dirname(filePath);

  await fs.mkdir(dirPath, { recursive: true, mode: 0o700 });
  try {
    await fs.chmod(dirPath, 0o700);
  } catch {
    console.warn(`[Auth] Failed to enforce 0700 on ${dirPath}`);
  }

  await fs.writeFile(filePath, value, { encoding: "utf8", mode: 0o600 });
  try {
    await fs.chmod(filePath, 0o600);
  } catch {
    console.warn(`[Auth] Failed to enforce 0600 on ${filePath}`);
  }
}

export function getConfiguredAccessTokenSync(): string {
  const envToken = sanitize(process.env.ORBIT_ACCESS_TOKEN ?? "");
  if (envToken) return envToken;
  return readPersistedAccessTokenSync();
}

export async function getConfiguredAccessToken(): Promise<string> {
  const envToken = sanitize(process.env.ORBIT_ACCESS_TOKEN ?? "");
  if (envToken) return envToken;
  return readPersistedAccessToken();
}

export function accessTokenFilePath(): string {
  return tokenFilePath();
}
