import { defineConfig, devices } from "@playwright/test";

import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const baseURL = "http://localhost:3000";

function readAccessToken(): string {
  const envToken = process.env.ORBIT_ACCESS_TOKEN?.trim();
  if (envToken) return envToken;
  try {
    return readFileSync(
      join(homedir(), ".orbit", "access-token"),
      "utf8",
    ).trim();
  } catch {
    return "";
  }
}

const token = readAccessToken();
const captureSensitiveArtifacts = !token && !process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./tests/e2e/artifacts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { outputFolder: "tests/e2e/playwright-report" }],
    ["list"],
  ],
  use: {
    baseURL,
    trace: captureSensitiveArtifacts ? "on-first-retry" : "off",
    screenshot: "only-on-failure",
    video: captureSensitiveArtifacts ? "on-first-retry" : "off",
    storageState: token
      ? {
          cookies: [
            {
              name: "orbit_token",
              value: token,
              domain: "localhost",
              path: "/",
              expires: -1,
              httpOnly: true,
              secure: false,
              sameSite: "Lax" as const,
            },
          ],
          origins: [],
        }
      : undefined,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
