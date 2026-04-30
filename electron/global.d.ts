import type { OrbitDesktopApi } from "./types";

declare global {
  interface Window {
    orbitDesktop?: OrbitDesktopApi;
  }
}

export {};
