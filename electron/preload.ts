import { contextBridge, ipcRenderer } from "electron";

import type {
  OrbitDesktopApi,
  OrbitDesktopConnectionProfile,
  OrbitDesktopConnectionStatus,
} from "./types";

function canUseDesktopApi() {
  const protocol = globalThis.location.protocol;
  const hostname = globalThis.location.hostname;
  return (
    protocol === "file:" ||
    ((protocol === "http:" || protocol === "https:") &&
      ["127.0.0.1", "localhost", "::1", "[::1]"].includes(hostname))
  );
}

const api: OrbitDesktopApi = {
  getProfiles: () => ipcRenderer.invoke("orbit-desktop:profiles:list"),
  saveProfile: (profile: OrbitDesktopConnectionProfile) =>
    ipcRenderer.invoke("orbit-desktop:profiles:save", profile),
  deleteProfile: (profileId: string) =>
    ipcRenderer.invoke("orbit-desktop:profiles:delete", profileId),
  connect: (profile: OrbitDesktopConnectionProfile) =>
    ipcRenderer.invoke("orbit-desktop:connect", profile),
  showConnectionPicker: () => ipcRenderer.invoke("orbit-desktop:picker:show"),
  getStatus: () => ipcRenderer.invoke("orbit-desktop:status"),
  onStatusChange: (callback: (status: OrbitDesktopConnectionStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: OrbitDesktopConnectionStatus) => {
      callback(status);
    };

    ipcRenderer.on("orbit-desktop:status-changed", listener);
    return () => ipcRenderer.removeListener("orbit-desktop:status-changed", listener);
  },
};

if (canUseDesktopApi()) {
  contextBridge.exposeInMainWorld("orbitDesktop", api);
}
