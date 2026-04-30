export type OrbitDesktopConnectionKind = "local" | "remote" | "ssh-tunnel";

export type OrbitDesktopConnectionProfile =
  | {
      id: string;
      kind: "local";
      name: string;
      port: "auto" | number;
      dataDir?: string;
    }
  | {
      id: string;
      kind: "remote";
      name: string;
      url: string;
      tokenKey?: string;
    }
  | {
      id: string;
      kind: "ssh-tunnel";
      name: string;
      sshHost: string;
      sshPort: number;
      sshUsername: string;
      remoteOrbitPort: number;
      localPort: "auto" | number;
      privateKeyPath?: string;
      tokenKey?: string;
    };

export type OrbitDesktopConnectionStatus = {
  state: "idle" | "connecting" | "connected" | "failed";
  message: string;
  url?: string;
  profileId?: string;
};

export type OrbitDesktopApi = {
  getProfiles(): Promise<OrbitDesktopConnectionProfile[]>;
  saveProfile(profile: OrbitDesktopConnectionProfile): Promise<OrbitDesktopConnectionProfile[]>;
  deleteProfile(profileId: string): Promise<OrbitDesktopConnectionProfile[]>;
  connect(profile: OrbitDesktopConnectionProfile): Promise<OrbitDesktopConnectionStatus>;
  showConnectionPicker(): Promise<void>;
  getStatus(): Promise<OrbitDesktopConnectionStatus>;
  onStatusChange(callback: (status: OrbitDesktopConnectionStatus) => void): () => void;
};
