"use client";

import { useEffect, useState } from "react";

export type Theme = "default" | "oled";

const STORAGE_KEY = "orbit-theme";
const DEFAULT_THEME: Theme = "default";

function isTheme(value: string | null): value is Theme {
  return value === "default" || value === "oled";
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;

  const storedTheme = window.localStorage.getItem(STORAGE_KEY);
  return isTheme(storedTheme) ? storedTheme : DEFAULT_THEME;
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;

  document.documentElement.setAttribute("data-theme", theme);
}

export function useTheme() {
  // Keep the first client render aligned with SSR, then hydrate from storage.
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    const storedTheme = getStoredTheme();
    setThemeState(storedTheme);
    applyTheme(storedTheme);
  }, []);

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    }

    applyTheme(nextTheme);
  };

  return { theme, setTheme, themes: ["default", "oled"] as const };
}
