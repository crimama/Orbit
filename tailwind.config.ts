import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        terminalBg: "var(--terminal-bg)",
        surface: {
          DEFAULT: "var(--surface)",
          elevated: "var(--surface-elevated)",
          overlay: "var(--surface-overlay)",
        },
        border: {
          DEFAULT: "var(--border)",
          focus: "var(--border-focus)",
        },
        status: {
          active: "var(--status-active)",
          paused: "var(--status-paused)",
          exited: "var(--status-exited)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
        },
        orbit: {
          bg: {
            primary: "var(--orbit-bg-primary)",
            secondary: "var(--orbit-bg-secondary)",
            tertiary: "var(--orbit-bg-tertiary)",
          },
          text: {
            primary: "var(--orbit-text-primary)",
            secondary: "var(--orbit-text-secondary)",
            muted: "var(--orbit-text-muted)",
          },
          border: {
            default: "var(--orbit-border-default)",
            subtle: "var(--orbit-border-subtle)",
          },
          accent: {
            primary: "var(--orbit-accent-primary)",
            hover: "var(--orbit-accent-hover)",
          },
          surface: {
            card: "var(--orbit-surface-card)",
            panel: "var(--orbit-surface-panel)",
            overlay: "var(--orbit-surface-overlay)",
          },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
