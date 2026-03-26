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
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
