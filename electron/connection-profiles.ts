import { app } from "electron";
import {
  defaultProfileStorePath,
  loadProfileStore,
  saveProfileStore,
  sanitizeProfile,
  type OrbitDesktopConnectionProfile,
} from "./profileStore";

function storePath(): string {
  return defaultProfileStorePath(app.getPath("userData"));
}

export async function loadProfiles(): Promise<OrbitDesktopConnectionProfile[]> {
  return (await loadProfileStore(storePath())).profiles;
}

export async function saveProfiles(profiles: OrbitDesktopConnectionProfile[]): Promise<void> {
  await saveProfileStore(storePath(), {
    version: 1,
    profiles: profiles.map(sanitizeProfile),
    lastProfileId: profiles.at(-1)?.id,
  });
}
