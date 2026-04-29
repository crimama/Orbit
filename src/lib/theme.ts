export const ORBIT_COLORS = {
  bg: {
    primary: "#0a0a0a",
    secondary: "#0f0f0f",
    tertiary: "#1a1a1a",
  },
  text: {
    primary: "#f5f5f5",
    secondary: "#a3a3a3",
    muted: "#737373",
  },
  border: {
    default: "#404040",
    subtle: "#2a2a2a",
  },
  accent: {
    primary: "#22d3ee",
    hover: "#67e8f9",
  },
  surface: {
    card: "#171717",
    panel: "#111111",
    overlay: "rgba(0,0,0,0.8)",
  },
} as const;

export const BUTTON_VARIANTS = {
  primary:
    "bg-orbit-accent-primary text-black hover:bg-orbit-accent-hover disabled:opacity-50 transition-colors",
  secondary:
    "border border-orbit-border-default bg-orbit-bg-tertiary text-orbit-text-primary hover:bg-neutral-800 disabled:opacity-50 transition-colors",
  danger:
    "bg-red-600/20 text-red-400 hover:bg-red-600/30 disabled:opacity-50 transition-colors",
} as const;
