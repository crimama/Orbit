import { app, BrowserWindow, ipcMain, shell, type BrowserWindowConstructorOptions } from "electron";
import path from "node:path";

import { loadProfiles as loadStoredProfiles, saveProfiles as saveStoredProfiles } from "./connection-profiles";
import { sanitizeProfile, type OrbitDesktopConnectionProfile } from "./profileStore";
import { startOrbitLocalServer, type OrbitLocalServerHandle } from "./serverSupervisor";
import { startSshTunnel } from "./ssh-tunnel";
import type { OrbitDesktopConnectionStatus } from "./types";
import { isLoopbackHostname, validateRemoteOrbitUrl } from "./urlValidation";

const PICKER_ORIGIN = "file://";

type WindowMode = "picker" | "orbit";
type SshTunnelHandle = Awaited<ReturnType<typeof startSshTunnel>>;
type DesktopConnectionRequest = OrbitDesktopConnectionProfile & {
  sessionAccessToken?: string;
};

let mainWindow: BrowserWindow | undefined;
let mainWindowMode: WindowMode | undefined;
let localServer: OrbitLocalServerHandle | undefined;
let sshTunnel: SshTunnelHandle | undefined;
let quitAfterCleanup = false;
let activeStatus: OrbitDesktopConnectionStatus = {
  state: "idle",
  message: "Choose an Orbit connection.",
};

function preloadPath() {
  return path.join(__dirname, "preload.cjs");
}

function connectionHtmlPath() {
  return path.join(__dirname, "connection.html");
}

async function readProfiles(): Promise<OrbitDesktopConnectionProfile[]> {
  return loadStoredProfiles();
}

async function writeProfiles(profiles: OrbitDesktopConnectionProfile[]) {
  await saveStoredProfiles(profiles);
}

function setStatus(status: OrbitDesktopConnectionStatus) {
  activeStatus = status;
  mainWindow?.webContents.send("orbit-desktop:status-changed", status);
}

function createWindow(mode: WindowMode) {
  const webPreferences: BrowserWindowConstructorOptions["webPreferences"] = {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    preload: mode === "picker" ? preloadPath() : undefined,
  };

  mainWindowMode = mode;
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 840,
    minHeight: 620,
    title: "Orbit",
    show: false,
    webPreferences,
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = undefined;
    mainWindowMode = undefined;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => undefined);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    const target = toUrl(targetUrl);
    if (!target) {
      event.preventDefault();
      return;
    }

    const currentUrl = mainWindow?.webContents.getURL() ?? "";
    if (currentUrl.startsWith(PICKER_ORIGIN) && target.protocol === "file:") return;

    if (!isAllowedOrbitNavigation(target)) {
      event.preventDefault();
      shell.openExternal(targetUrl).catch(() => undefined);
    }
  });

  return mainWindow;
}

function ensureWindow(mode: WindowMode) {
  if (!mainWindow || mainWindow.isDestroyed()) return createWindow(mode);
  if (mainWindowMode === mode) return mainWindow;

  mainWindow.destroy();
  return createWindow(mode);
}

function toUrl(rawUrl: string): URL | undefined {
  try {
    return new URL(rawUrl);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stripSessionSecrets(request: unknown): unknown {
  if (!isRecord(request)) return request;
  const { sessionAccessToken: _sessionAccessToken, ...profile } = request;
  return profile;
}

function sessionAccessToken(request: unknown): string | undefined {
  if (!isRecord(request)) return undefined;
  const token = request.sessionAccessToken;
  if (typeof token !== "string") return undefined;
  const trimmed = token.replace(/[\r\n]/g, "").trim();
  return trimmed || undefined;
}

function appendOneShotToken(url: URL, token: string | undefined) {
  if (token) url.searchParams.set("token", token);
}

function isLoopbackUrl(url: URL) {
  return (url.protocol === "http:" || url.protocol === "https:") && isLoopbackHostname(url.hostname);
}

function assertPickerIpc(event: Electron.IpcMainInvokeEvent) {
  const url = event.senderFrame?.url ?? event.sender.getURL();
  if (!url.startsWith(PICKER_ORIGIN)) {
    throw new Error("Connection profile IPC is only available to the Orbit connection picker.");
  }
}

function assertTrustedDesktopIpc(event: Electron.IpcMainInvokeEvent) {
  assertPickerIpc(event);
}

function normalizeRemoteUrl(rawUrl: string) {
  const validation = validateRemoteOrbitUrl(rawUrl);
  if (!validation.ok) throw new Error(validation.error);
  return validation.url;
}

function isAllowedOrbitNavigation(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (isLoopbackHostname(url.hostname)) return true;
  return activeStatus.url ? url.origin === new URL(activeStatus.url).origin : false;
}

async function stopLocalServer() {
  const server = localServer;
  localServer = undefined;
  if (server) await server.stop();
}

async function stopSshTunnel() {
  const tunnel = sshTunnel;
  sshTunnel = undefined;
  if (tunnel?.stop) await tunnel.stop();
}

async function stopActiveConnection() {
  await Promise.all([stopLocalServer(), stopSshTunnel()]);
}

async function showConnectionPicker(status?: OrbitDesktopConnectionStatus) {
  await stopActiveConnection();
  const window = ensureWindow("picker");
  setStatus(status ?? { state: "idle", message: "Choose an Orbit connection." });
  await window.loadFile(connectionHtmlPath());
  if (status) setStatus(status);
}

async function loadOrbitUrl(url: URL, profile: OrbitDesktopConnectionProfile, message: string) {
  const window = ensureWindow("orbit");
  setStatus({
    state: "connecting",
    message: `Loading ${url.origin}...`,
    profileId: profile.id,
    url: url.toString(),
  });
  await window.loadURL(url.toString());
  setStatus({ state: "connected", message, profileId: profile.id, url: url.toString() });
  return activeStatus;
}

async function connect(request: DesktopConnectionRequest): Promise<OrbitDesktopConnectionStatus> {
  await stopActiveConnection();
  const profile = sanitizeProfile(stripSessionSecrets(request));
  const oneShotToken = sessionAccessToken(request);

  try {
    if (profile.kind === "remote") {
      const url = normalizeRemoteUrl(profile.url);
      appendOneShotToken(url, oneShotToken);
      return await loadOrbitUrl(url, profile, `Connected to ${url.origin}.`);
    }

    if (profile.kind === "local") {
      localServer = await startOrbitLocalServer(profile);
      const validation = validateRemoteOrbitUrl(localServer.url);
      if (!validation.ok || !isLoopbackUrl(validation.url)) {
        throw new Error("Local Orbit supervisor returned a non-loopback URL.");
      }
      validation.url.searchParams.set("token", localServer.accessToken);
      return await loadOrbitUrl(validation.url, profile, "Connected to local Orbit on this Mac.");
    }

    sshTunnel = await startSshTunnel(profile);
    const validation = validateRemoteOrbitUrl(sshTunnel.url);
    if (!validation.ok || !isLoopbackUrl(validation.url)) {
      throw new Error("SSH tunnel supervisor returned a non-loopback URL.");
    }
    appendOneShotToken(validation.url, oneShotToken);
    return await loadOrbitUrl(validation.url, profile, sshTunnel.message ?? "Connected through SSH tunnel.");
  } catch (error) {
    await stopActiveConnection();
    const message = error instanceof Error ? error.message : String(error);
    await showConnectionPicker({ state: "failed", message, profileId: profile.id });
    throw error;
  }
}

function registerIpc() {
  ipcMain.handle("orbit-desktop:profiles:list", async (event) => {
    assertPickerIpc(event);
    return readProfiles();
  });

  ipcMain.handle("orbit-desktop:profiles:save", async (event, profile: unknown) => {
    assertPickerIpc(event);
    const sanitized = sanitizeProfile(profile);
    const profiles = (await readProfiles()).filter((item) => item.id !== sanitized.id);
    profiles.push(sanitized);
    await writeProfiles(profiles);
    return readProfiles();
  });

  ipcMain.handle("orbit-desktop:profiles:delete", async (event, profileId: unknown) => {
    assertPickerIpc(event);
    if (typeof profileId !== "string") throw new Error("Invalid profile id.");
    const profiles = (await readProfiles()).filter((item) => item.id !== profileId);
    await writeProfiles(profiles);
    return profiles;
  });

  ipcMain.handle("orbit-desktop:connect", async (event, profile: DesktopConnectionRequest) => {
    assertPickerIpc(event);
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

app.on("before-quit", (event) => {
  if (quitAfterCleanup) return;
  event.preventDefault();
  quitAfterCleanup = true;
  stopActiveConnection().finally(() => app.quit());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
