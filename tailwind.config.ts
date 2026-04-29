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
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
