import { app, BrowserWindow, ipcMain, shell } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import path from "node:path";

import type { OrbitDesktopConnectionProfile, OrbitDesktopConnectionStatus } from "./types";

const PICKER_ORIGIN = "file://";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const requireOptional = createRequire(__filename);

let mainWindow: BrowserWindow | undefined;
let activeStatus: OrbitDesktopConnectionStatus = {
  state: "idle",
  message: "Choose an Orbit connection.",
};

function profilesPath() {
  return path.join(app.getPath("userData"), "connection-profiles.json");
}

function preloadPath() {
  return path.join(__dirname, "preload.ts");
}

function connectionHtmlPath() {
  return path.join(__dirname, "connection.html");
}

type OptionalProfileStore = {
  loadProfiles?: () => Promise<OrbitDesktopConnectionProfile[]>;
  saveProfiles?: (profiles: OrbitDesktopConnectionProfile[]) => Promise<void>;
};

type OptionalServerSupervisor = {
  startLocalOrbitServer?: (profile: Extract<OrbitDesktopConnectionProfile, { kind: "local" }>) => Promise<{ url: string; message?: string }>;
};

type OptionalTunnelSupervisor = {
  startSshTunnel?: (profile: Extract<OrbitDesktopConnectionProfile, { kind: "ssh-tunnel" }>) => Promise<{ url: string; message?: string }>;
};

function loadOptionalModule<T>(modulePath: string): T | undefined {
  try {
    return requireOptional(modulePath) as T;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "MODULE_NOT_FOUND" || code === "ERR_MODULE_NOT_FOUND") return undefined;
    throw error;
  }
}

function optionalProfileStore() {
  return loadOptionalModule<OptionalProfileStore>("./connection-profiles");
}

function optionalServerSupervisor() {
  return loadOptionalModule<OptionalServerSupervisor>("./server-supervisor");
}

function optionalTunnelSupervisor() {
  return loadOptionalModule<OptionalTunnelSupervisor>("./ssh-tunnel");
}

async function readProfiles(): Promise<OrbitDesktopConnectionProfile[]> {
  const store = optionalProfileStore();
  if (store?.loadProfiles) return (await store.loadProfiles()).filter(isProfile);

  try {
    const raw = await readFile(profilesPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isProfile);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeProfiles(profiles: OrbitDesktopConnectionProfile[]) {
  const store = optionalProfileStore();
  if (store?.saveProfiles) {
    await store.saveProfiles(profiles);
    return;
  }

  await mkdir(path.dirname(profilesPath()), { recursive: true });
  await writeFile(profilesPath(), `${JSON.stringify(profiles, null, 2)}\n`, "utf8");
}

function setStatus(status: OrbitDesktopConnectionStatus) {
  activeStatus = status;
  mainWindow?.webContents.send("orbit-desktop:status-changed", status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPort(value: unknown): value is "auto" | number {
  return value === "auto" || (Number.isInteger(value) && Number(value) > 0 && Number(value) <= 65535);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isProfile(value: unknown): value is OrbitDesktopConnectionProfile {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || typeof value.name !== "string") return false;

  if (value.kind === "local") {
    return isPort(value.port) && isOptionalString(value.dataDir);
  }

  if (value.kind === "remote") {
    return typeof value.url === "string" && isOptionalString(value.tokenKey);
  }

  if (value.kind === "ssh-tunnel") {
    return (
      typeof value.sshHost === "string" &&
      Number.isInteger(value.sshPort) &&
      Number(value.sshPort) > 0 &&
      Number(value.sshPort) <= 65535 &&
      typeof value.sshUsername === "string" &&
      Number.isInteger(value.remoteOrbitPort) &&
      Number(value.remoteOrbitPort) > 0 &&
      Number(value.remoteOrbitPort) <= 65535 &&
      isPort(value.localPort) &&
      isOptionalString(value.privateKeyPath) &&
      isOptionalString(value.tokenKey)
    );
  }

  return false;
}

function isLoopbackUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return (url.protocol === "http:" || url.protocol === "https:") && LOOPBACK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function assertPickerIpc(event: Electron.IpcMainInvokeEvent) {
  const url = event.senderFrame.url;
  if (!url.startsWith(PICKER_ORIGIN)) {
    throw new Error("Connection profile IPC is only available to the Orbit connection picker.");
  }
}

function assertTrustedDesktopIpc(event: Electron.IpcMainInvokeEvent) {
  const url = event.senderFrame.url;
  if (!url.startsWith(PICKER_ORIGIN) && !isLoopbackUrl(url)) {
    throw new Error("Desktop IPC is only available to the connection picker or trusted loopback Orbit pages.");
  }
}

function validateRemoteUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Orbit remote URLs must use http or https.");
  }
  return url;
}

async function getAvailablePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === "object" && address) resolve(address.port);
        else reject(new Error("Unable to allocate a local port."));
      });
    });
  });
}

async function resolveLoopbackUrl(port: "auto" | number) {
  const selectedPort = port === "auto" ? await getAvailablePort() : port;
  return new URL(`http://127.0.0.1:${selectedPort}`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 840,
    minHeight: 620,
    title: "Orbit",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: preloadPath(),
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => undefined);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    const target = new URL(targetUrl);
    const currentUrl = mainWindow?.webContents.getURL() ?? "";
    if (currentUrl.startsWith(PICKER_ORIGIN) && target.protocol === "file:") return;
    if (!isAllowedOrbitNavigation(target)) {
      event.preventDefault();
      shell.openExternal(targetUrl).catch(() => undefined);
    }
  });

  return mainWindow;
}

function isAllowedOrbitNavigation(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (LOOPBACK_HOSTS.has(url.hostname)) return true;
  return activeStatus.url ? url.origin === new URL(activeStatus.url).origin : false;
}

async function showConnectionPicker() {
  const window = mainWindow ?? createWindow();
  setStatus({ state: "idle", message: "Choose an Orbit connection." });
  await window.loadFile(connectionHtmlPath());
}

async function loadOrbitUrl(url: URL, profile: OrbitDesktopConnectionProfile, message: string) {
  const window = mainWindow ?? createWindow();
  setStatus({ state: "connecting", message: `Loading ${url.origin}…`, profileId: profile.id, url: url.toString() });
  await window.loadURL(url.toString());
  setStatus({ state: "connected", message, profileId: profile.id, url: url.toString() });
  return activeStatus;
}

async function connect(profile: OrbitDesktopConnectionProfile): Promise<OrbitDesktopConnectionStatus> {
  if (!isProfile(profile)) throw new Error("Invalid Orbit desktop connection profile.");

  if (profile.kind === "remote") {
    const url = validateRemoteUrl(profile.url);
    return loadOrbitUrl(url, profile, `Connected to ${url.origin}.`);
  }

  if (profile.kind === "local") {
    const supervisor = optionalServerSupervisor();
    if (supervisor?.startLocalOrbitServer) {
      const result = await supervisor.startLocalOrbitServer(profile);
      const url = validateRemoteUrl(result.url);
      if (!isLoopbackUrl(url.toString())) throw new Error("Local Orbit supervisor returned a non-loopback URL.");
      return loadOrbitUrl(url, profile, result.message ?? "Connected to local Orbit on this Mac.");
    }

    const url = await resolveLoopbackUrl(profile.port);
    return loadOrbitUrl(
      url,
      profile,
      "Loaded loopback Orbit URL. Local auto-start API was not available yet.",
    );
  }

  const tunnel = optionalTunnelSupervisor();
  if (tunnel?.startSshTunnel) {
    const result = await tunnel.startSshTunnel(profile);
    const url = validateRemoteUrl(result.url);
    if (!isLoopbackUrl(url.toString())) throw new Error("SSH tunnel supervisor returned a non-loopback URL.");
    return loadOrbitUrl(url, profile, result.message ?? "Connected through SSH tunnel.");
  }

  const localUrl = await resolveLoopbackUrl(profile.localPort);
  return loadOrbitUrl(
    localUrl,
    profile,
    "Loaded SSH tunnel loopback URL. Tunnel supervisor API was not available yet.",
  );
}

function registerIpc() {
  ipcMain.handle("orbit-desktop:profiles:list", async (event) => {
    assertPickerIpc(event);
    return readProfiles();
  });

  ipcMain.handle("orbit-desktop:profiles:save", async (event, profile: unknown) => {
    assertPickerIpc(event);
    if (!isProfile(profile)) throw new Error("Invalid Orbit connection profile.");
    const profiles = (await readProfiles()).filter((item) => item.id !== profile.id);
    profiles.push(profile);
    await writeProfiles(profiles);
    return profiles;
  });

  ipcMain.handle("orbit-desktop:profiles:delete", async (event, profileId: unknown) => {
    assertPickerIpc(event);
    if (typeof profileId !== "string") throw new Error("Invalid profile id.");
    const profiles = (await readProfiles()).filter((item) => item.id !== profileId);
    await writeProfiles(profiles);
    return profiles;
  });

  ipcMain.handle("orbit-desktop:connect", async (event, profile: unknown) => {
    assertPickerIpc(event);
    if (!isProfile(profile)) throw new Error("Invalid Orbit connection profile.");
    return connect(profile);
  });

  ipcMain.handle("orbit-desktop:picker:show", async (event) => {
    assertTrustedDesktopIpc(event);
    await showConnectionPicker();
  });

  ipcMain.handle("orbit-desktop:status", async (event) => {
    assertTrustedDesktopIpc(event);
    return activeStatus;
  });
}

app.whenReady().then(async () => {
  registerIpc();
  await showConnectionPicker();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      showConnectionPicker().catch((error) => setStatus({ state: "failed", message: String(error) }));
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
