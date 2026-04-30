const { contextBridge, ipcRenderer } = require("electron");

function canUseDesktopApi() {
  return globalThis.location.protocol === "file:";
}

const api = {
  getProfiles: () => ipcRenderer.invoke("orbit-desktop:profiles:list"),
  saveProfile: (profile) => ipcRenderer.invoke("orbit-desktop:profiles:save", profile),
  deleteProfile: (profileId) => ipcRenderer.invoke("orbit-desktop:profiles:delete", profileId),
  connect: (profile) => ipcRenderer.invoke("orbit-desktop:connect", profile),
  showConnectionPicker: () => ipcRenderer.invoke("orbit-desktop:picker:show"),
  getStatus: () => ipcRenderer.invoke("orbit-desktop:status"),
  onStatusChange: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("orbit-desktop:status-changed", listener);
    return () => ipcRenderer.removeListener("orbit-desktop:status-changed", listener);
  },
};

if (canUseDesktopApi()) {
  contextBridge.exposeInMainWorld("orbitDesktop", api);
}
