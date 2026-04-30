import type { OrbitDesktopConnectionProfile } from "./profileStore";

export type {
  LocalConnectionProfile,
  OrbitDesktopConnectionProfile,
  OrbitDesktopConnectionProfile as OrbitDesktopProfile,
  RemoteConnectionProfile,
  SshTunnelConnectionProfile,
} from "./profileStore";

export type OrbitDesktopConnectionKind = OrbitDesktopConnectionProfile["kind"];

export type OrbitDesktopConnectionStatus = {
  state: "idle" | "connecting" | "connected" | "failed";
  message: string;
  url?: string;
  profileId?: string;
  diagnostic?: string;
  diagnosticCode?: string;
};

export type OrbitDesktopCapabilities = {
  packaged: boolean;
  localModeEnabled: boolean;
  sshTunnelEnabled: boolean;
  packagingProfile: "remote-url" | "developer-preview";
  unavailableReason?: string;
};

export type OrbitDesktopApi = {
  getCapabilities(): Promise<OrbitDesktopCapabilities>;
  getProfiles(): Promise<OrbitDesktopConnectionProfile[]>;
  saveProfile(
    profile: OrbitDesktopConnectionProfile,
  ): Promise<OrbitDesktopConnectionProfile[]>;
  deleteProfile(profileId: string): Promise<OrbitDesktopConnectionProfile[]>;
  connect(
    profile: OrbitDesktopConnectionProfile,
  ): Promise<OrbitDesktopConnectionStatus>;
  showConnectionPicker(): Promise<void>;
  getStatus(): Promise<OrbitDesktopConnectionStatus>;
  onStatusChange(
    callback: (status: OrbitDesktopConnectionStatus) => void,
  ): () => void;
};
