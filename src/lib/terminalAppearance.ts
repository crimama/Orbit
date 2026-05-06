import type { ITheme } from "@xterm/xterm";
import type { Theme } from "@/lib/hooks/useTheme";

export const TERMINAL_FONT_FAMILY =
  '"SF Mono", Menlo, Monaco, "Apple SD Gothic Neo", "Noto Sans Mono CJK KR", ui-monospace, monospace';

export function getTerminalTheme(theme: Theme): ITheme {
  if (theme === "warm") {
    return {
      background: "#f2ead7",
      foreground: "#2d281d",
      cursor: "#0f7d91",
      selectionBackground: "#d0bd8f",
      black: "#2d281d",
      red: "#9f3434",
      green: "#507536",
      yellow: "#92712c",
      blue: "#176f91",
      magenta: "#87598c",
      cyan: "#0f7d91",
      white: "#ede3c9",
      brightBlack: "#8c7a55",
      brightRed: "#b84a4a",
      brightGreen: "#638b43",
      brightYellow: "#a98431",
      brightBlue: "#2180a3",
      brightMagenta: "#9b67a0",
      brightCyan: "#1295aa",
      brightWhite: "#fff7e5",
    };
  }

  if (theme === "oled") {
    return {
      background: "#000000",
      foreground: "#e6edf3",
      cursor: "#93c5fd",
      selectionBackground: "#1e293b",
    };
  }

  return {
    background: "#0b1220",
    foreground: "#e6edf3",
    cursor: "#93c5fd",
    selectionBackground: "#334155",
  };
}
