import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  shell,
  type BrowserWindowConstructorOptions,
  type MenuItemConstructorOptions,
} from "electron";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  loadProfiles as loadStoredProfiles,
  saveProfiles as saveStoredProfiles,
} from "./connection-profiles";
import {
  sanitizeProfile,
  type OrbitDesktopConnectionProfile,
} from "./profileStore";
import {
  startOrbitLocalServer,
  type OrbitLocalServerHandle,
} from "./serverSupervisor";
import { startSshTunnel } from "./ssh-tunnel";
import type {
  OrbitDesktopCapabilities,
  OrbitDesktopConnectionStatus,
} from "./types";
import { isLoopbackHostname, validateRemoteOrbitUrl } from "./urlValidation";

const PICKER_ORIGIN = "file://";

type WindowMode = "picker" | "orbit";
type SshTunnelHandle = Awaited<ReturnType<typeof startSshTunnel>>;
type DesktopConnectionRequest = OrbitDesktopConnectionProfile & {
  sessionAccessToken?: string;
};

let mainWindow: BrowserWindow | undefined;
let mainWindowMode: WindowMode | undefined;
const orbitWindows = new Set<BrowserWindow>();
let localServer: OrbitLocalServerHandle | undefined;
let sshTunnel: SshTunnelHandle | undefined;
let quitAfterCleanup = false;
let activeStatus: OrbitDesktopConnectionStatus = {
  state: "idle",
  message: "Choose an Orbit connection.",
};

function packagedAppRoot() {
  return path.join(__dirname, "..");
}

function hasPackagedLocalRuntime() {
  const root = packagedAppRoot();
  return (
    existsSync(path.join(root, ".next", "BUILD_ID")) &&
    existsSync(path.join(root, "dist", "server.js")) &&
    existsSync(path.join(root, "prisma", "schema.prisma")) &&
    existsSync(path.join(root, "scripts", "desktop-db-bootstrap.mjs"))
  );
}

function isLocalModeEnabledInPackagedApp() {
  if (!app.isPackaged) return true;
  if (process.env.ORBIT_DESKTOP_ENABLE_PACKAGED_LOCAL === "1") return true;
  return hasPackagedLocalRuntime();
}

function isRemoteOnlyPackagedApp() {
  return app.isPackaged && !isLocalModeEnabledInPackagedApp();
}

function desktopCapabilities(): OrbitDesktopCapabilities {
  const remoteOnly = isRemoteOnlyPackagedApp();
  const localModeEnabled = isLocalModeEnabledInPackagedApp();
  return {
    packaged: app.isPackaged,
    localModeEnabled,
    sshTunnelEnabled: !app.isPackaged,
    packagingProfile: remoteOnly
      ? "remote-url"
      : app.isPackaged
        ? "local-runtime"
        : "developer-preview",
    unavailableReason: remoteOnly
      ? "This unsigned packaged preview connects to a remote Orbit server. Local This Mac and SSH Tunnel packaging are not enabled yet."
      : app.isPackaged
        ? "This packaged app can start Orbit on this Mac. SSH Tunnel packaging is not enabled yet."
        : undefined,
  };
}

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
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("orbit-desktop:status-changed", status);
  }
}

function createBrowserWindow(mode: WindowMode) {
  const webPreferences: BrowserWindowConstructorOptions["webPreferences"] = {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    preload: mode === "picker" ? preloadPath() : undefined,
  };

  const window = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 840,
    minHeight: 620,
    title: "Orbit",
    show: false,
    webPreferences,
  });

  if (mode === "orbit") {
    orbitWindows.add(window);
  }

  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    orbitWindows.delete(window);
    if (mainWindow === window) {
      mainWindow = undefined;
      mainWindowMode = undefined;
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => undefined);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, targetUrl) => {
    const target = toUrl(targetUrl);
    if (!target) {
      event.preventDefault();
      return;
    }

    const currentUrl = window.webContents.getURL();
    if (currentUrl.startsWith(PICKER_ORIGIN) && target.protocol === "file:")
      return;

    if (!isAllowedOrbitNavigation(target)) {
      event.preventDefault();
      shell.openExternal(targetUrl).catch(() => undefined);
    }
  });

  return window;
}

function createWindow(mode: WindowMode) {
  mainWindowMode = mode;
  mainWindow = createBrowserWindow(mode);
  return mainWindow;
}

function ensureWindow(mode: WindowMode) {
  if (!mainWindow || mainWindow.isDestroyed()) return createWindow(mode);
  if (mainWindowMode === mode) return mainWindow;

  mainWindow.destroy();
  return createWindow(mode);
}

function closeOrbitWindows() {
  for (const window of Array.from(orbitWindows)) {
    if (!window.isDestroyed()) {
      window.destroy();
    }
  }
  orbitWindows.clear();
}

async function openOrbitWindowFromActiveConnection() {
  if (activeStatus.state !== "connected" || !activeStatus.url) {
    await showConnectionPicker();
    return;
  }

  const url = new URL(activeStatus.url);
  const window = createBrowserWindow("orbit");
  await window.loadURL(url.toString());
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
  const profile = { ...request };
  delete profile.sessionAccessToken;
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

function withoutOneShotToken(url: URL): string {
  const safeUrl = new URL(url.toString());
  safeUrl.searchParams.delete("token");
  return safeUrl.toString();
}

function redactConnectionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/([?&]token=)[^&\s]+/gi, "$1[redacted]")
    .replace(/(orbit_token=)[^;\s]+/gi, "$1[redacted]");
}

function safeConnectionFailureStatus(
  profile: OrbitDesktopConnectionProfile,
  error: unknown,
): OrbitDesktopConnectionStatus {
  const detail = redactConnectionError(error);
  const base = { state: "failed" as const, profileId: profile.id };

  if (profile.kind === "remote") {
    const validation = validateRemoteOrbitUrl(profile.url);
    const target = validation.ok
      ? validation.url.origin
      : "the remote Orbit URL";
    return {
      ...base,
      message: `Could not connect to ${target}.`,
      diagnosticCode: validation.ok
        ? "REMOTE_LOAD_FAILED"
        : "REMOTE_URL_INVALID",
      diagnostic: validation.ok
        ? `Verify the Orbit server is reachable, the HTTPS certificate is trusted, and the URL path is correct. Session tokens are never saved and were removed from diagnostics. Detail: ${detail}`
        : `Fix the saved URL: ${validation.error}. Session tokens belong in the session-only token field, not in profile URLs.`,
    };
  }

  if (profile.kind === "ssh-tunnel") {
    return {
      ...base,
      message: `Could not open SSH tunnel to ${profile.sshUsername}@${profile.sshHost}:${profile.sshPort}.`,
      diagnosticCode: "SSH_TUNNEL_FAILED",
      diagnostic: `Verify SSH reachability, host key trust, credentials or key agent, local port availability, remote port ${profile.remoteOrbitPort}, and that Orbit is running on remote loopback. Session tokens are never saved and were removed from diagnostics. Detail: ${detail}`,
    };
  }

  return {
    ...base,
    message: "Could not start local Orbit on this Mac.",
    diagnosticCode: "LOCAL_START_FAILED",
    diagnostic: `Verify the local build, database bootstrap, and selected port. Detail: ${detail}`,
  };
}

function isLoopbackUrl(url: URL) {
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    isLoopbackHostname(url.hostname)
  );
}

function assertPickerIpc(event: Electron.IpcMainInvokeEvent) {
  const url = event.senderFrame?.url ?? event.sender.getURL();
  if (!url.startsWith(PICKER_ORIGIN)) {
    throw new Error(
      "Connection profile IPC is only available to the Orbit connection picker.",
    );
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
  return activeStatus.url
    ? url.origin === new URL(activeStatus.url).origin
    : false;
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
  closeOrbitWindows();
  await stopActiveConnection();
  const window = ensureWindow("picker");
  setStatus(
    status ?? { state: "idle", message: "Choose an Orbit connection." },
  );
  await window.loadFile(connectionHtmlPath());
  if (status) setStatus(status);
}

function installApplicationMenu() {
  const isMac = process.platform === "darwin";
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New Window",
          accelerator: "CommandOrControl+N",
          click: () => {
            openOrbitWindowFromActiveConnection().catch((error) =>
              setStatus({ state: "failed", message: String(error) }),
            );
          },
        },
        {
          label: "Connection Picker",
          accelerator: "CommandOrControl+Shift+N",
          click: () => {
            showConnectionPicker().catch((error) =>
              setStatus({ state: "failed", message: String(error) }),
            );
          },
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [
              { type: "separator" as const },
              { role: "front" as const },
            ]
          : []),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function loadOrbitUrl(
  url: URL,
  profile: OrbitDesktopConnectionProfile,
  message: string,
) {
  const window = ensureWindow("orbit");
  const safeStatusUrl = withoutOneShotToken(url);
  setStatus({
    state: "connecting",
    message: `Loading ${url.origin}...`,
    profileId: profile.id,
    url: safeStatusUrl,
  });
  await window.loadURL(url.toString());
  setStatus({
    state: "connected",
    message,
    profileId: profile.id,
    url: safeStatusUrl,
  });
  return activeStatus;
}

async function connect(
  request: DesktopConnectionRequest,
): Promise<OrbitDesktopConnectionStatus> {
  await stopActiveConnection();
  const profile = sanitizeProfile(stripSessionSecrets(request));
  const oneShotToken = sessionAccessToken(request);
  const capabilities = desktopCapabilities();

  if (profile.kind === "local" && !capabilities.localModeEnabled) {
    const status = {
      state: "failed" as const,
      profileId: profile.id,
      message: "This Mac is not available in this packaged preview.",
      diagnosticCode: "PACKAGED_REMOTE_ONLY",
      diagnostic: capabilities.unavailableReason,
    };
    await showConnectionPicker(status);
    throw new Error(
      [status.message, status.diagnostic].filter(Boolean).join(" "),
    );
  }

  if (profile.kind === "ssh-tunnel" && !capabilities.sshTunnelEnabled) {
    const status = {
      state: "failed" as const,
      profileId: profile.id,
      message: "SSH Tunnel is not available in this packaged preview.",
      diagnosticCode: "PACKAGED_REMOTE_ONLY",
      diagnostic: capabilities.unavailableReason,
    };
    await showConnectionPicker(status);
    throw new Error(
      [status.message, status.diagnostic].filter(Boolean).join(" "),
    );
  }

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
      return await loadOrbitUrl(
        validation.url,
        profile,
        "Connected to local Orbit on this Mac.",
      );
    }

    sshTunnel = await startSshTunnel(profile);
    const validation = validateRemoteOrbitUrl(sshTunnel.url);
    if (!validation.ok || !isLoopbackUrl(validation.url)) {
      throw new Error("SSH tunnel supervisor returned a non-loopback URL.");
    }
    appendOneShotToken(validation.url, oneShotToken);
    return await loadOrbitUrl(
      validation.url,
      profile,
      sshTunnel.message ?? "Connected through SSH tunnel.",
    );
  } catch (error) {
    await stopActiveConnection();
    const failureStatus = safeConnectionFailureStatus(profile, error);
    await showConnectionPicker(failureStatus);
    throw new Error(
      [failureStatus.message, failureStatus.diagnostic]
        .filter(Boolean)
        .join(" "),
    );
  }
}

function registerIpc() {
  ipcMain.handle("orbit-desktop:capabilities", async (event) => {
    assertPickerIpc(event);
    return desktopCapabilities();
  });

  ipcMain.handle("orbit-desktop:profiles:list", async (event) => {
    assertPickerIpc(event);
    return readProfiles();
  });

  ipcMain.handle(
    "orbit-desktop:profiles:save",
    async (event, profile: unknown) => {
      assertPickerIpc(event);
      const sanitized = sanitizeProfile(profile);
      const profiles = (await readProfiles()).filter(
        (item) => item.id !== sanitized.id,
      );
      profiles.push(sanitized);
      await writeProfiles(profiles);
      return readProfiles();
    },
  );

  ipcMain.handle(
    "orbit-desktop:profiles:delete",
    async (event, profileId: unknown) => {
      assertPickerIpc(event);
      if (typeof profileId !== "string") throw new Error("Invalid profile id.");
      const profiles = (await readProfiles()).filter(
        (item) => item.id !== profileId,
      );
      await writeProfiles(profiles);
      return profiles;
    },
  );

  ipcMain.handle(
    "orbit-desktop:connect",
    async (event, profile: DesktopConnectionRequest) => {
      assertPickerIpc(event);
      return connect(profile);
    },
  );

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
  installApplicationMenu();
  registerIpc();
  await showConnectionPicker();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const opener =
        activeStatus.state === "connected" && activeStatus.url
          ? openOrbitWindowFromActiveConnection
          : showConnectionPicker;
      opener().catch((error) =>
        setStatus({ state: "failed", message: String(error) }),
      );
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
