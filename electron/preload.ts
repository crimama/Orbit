import { contextBridge, ipcRenderer } from "electron";

import type {
  OrbitDesktopApi,
  OrbitDesktopConnectionProfile,
  OrbitDesktopConnectionStatus,
} from "./types";

function canUseDesktopApi() {
  return globalThis.location.protocol === "file:";
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
