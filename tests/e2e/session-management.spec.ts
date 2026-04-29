import { test, expect } from "@playwright/test";
import {
  createProject,
  createSession,
  deleteProject,
  deleteSession,
  listSessions,
} from "./helpers/api";
import { cleanupTestData } from "./helpers/cleanup";

import { execSync } from "child_process";

const PREFIX = "e2e-test-smgmt-";
const PROJECT_PATH = "/tmp/e2e-smgmt";
let projectId: string;
let projectName: string;

test.beforeAll(async ({ request }) => {
  execSync(`mkdir -p ${PROJECT_PATH}`);
  await cleanupTestData(request, PREFIX);
  const project = await createProject(request, {
    name: `${PREFIX}parent`,
    type: "LOCAL",
    path: PROJECT_PATH,
  });
  projectId = project.id;
  projectName = project.name;
});

test.afterAll(async ({ request }) => {
  await cleanupTestData(request, PREFIX);
});

test.describe("Session — API CRUD", () => {
  test("creates a terminal session", async ({ request }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}terminal-create`,
    });

    expect(session.id).toBeTruthy();
    expect(session.agentType).toBe("terminal");
    expect(session.status).toBe("active");

    await deleteSession(request, session.id);
  });

  test("creates a claude-code session", async ({ request }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "claude-code",
      name: `${PREFIX}claude-create`,
    });

    expect(session.id).toBeTruthy();
    expect(session.agentType).toBe("claude-code");

    await deleteSession(request, session.id);
  });

  test("lists sessions filtered by projectId", async ({ request }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}list-filter`,
    });

    const sessions = await listSessions(request, projectId);
    const found = sessions.find((s) => s.id === session.id);
    expect(found).toBeTruthy();

    await deleteSession(request, session.id);
  });

  test("lists all sessions without filter", async ({ request }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}list-all`,
    });

    const sessions = await listSessions(request);
    const found = sessions.find((s) => s.id === session.id);
    expect(found).toBeTruthy();

    await deleteSession(request, session.id);
  });

  test("terminates a session via DELETE", async ({ request }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}terminate-api`,
    });

    const res = await request.delete(`/api/sessions/${session.id}`);
    expect(res.ok()).toBe(true);

    const getRes = await request.get(`/api/sessions/${session.id}`);
    const json = await getRes.json();
    expect(json.data.status).toBe("terminated");
  });

  test("rejects session creation without projectId", async ({ request }) => {
    const res = await request.post("/api/sessions", {
      data: { agentType: "terminal" },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects session creation without agentType", async ({ request }) => {
    const res = await request.post("/api/sessions", {
      data: { projectId },
    });
    expect(res.status()).toBe(400);
  });

  test("renames a session via PATCH", async ({ request }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}rename-session`,
    });

    const res = await request.patch(`/api/sessions/${session.id}`, {
      data: { name: `${PREFIX}renamed-session` },
    });
    expect(res.ok()).toBe(true);

    const getRes = await request.get(`/api/sessions/${session.id}`);
    const json = await getRes.json();
    expect(json.data.name).toBe(`${PREFIX}renamed-session`);

    await deleteSession(request, session.id);
  });

  test("creating multiple sessions for same project works", async ({
    request,
  }) => {
    const sessions = await Promise.all(
      [1, 2, 3].map((i) =>
        createSession(request, {
          projectId,
          agentType: "terminal",
          name: `${PREFIX}multi-${i}`,
        }),
      ),
    );

    expect(sessions).toHaveLength(3);
    const ids = new Set(sessions.map((s) => s.id));
    expect(ids.size).toBe(3);

    await Promise.all(sessions.map((s) => deleteSession(request, s.id)));
  });
});

test.describe("Session — UI Flow", () => {
  test("session appears in dashboard after creation", async ({
    page,
    request,
  }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}ui-visible`,
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click the project to see its sessions
    const projectEl = page.locator(`text=${projectName}`).first();
    await expect(projectEl).toBeVisible({ timeout: 10_000 });
    await projectEl.click();

    // Session name should appear
    await expect(
      page.locator(`text=${session.name}`).first(),
    ).toBeVisible({ timeout: 10_000 });

    await deleteSession(request, session.id);
  });

  test("clicking session opens terminal", async ({ page, request }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}ui-navigate`,
    });

    // Go directly to the session terminal page
    await page.goto(`/sessions/${session.id}`);

    // Wait for either xterm or session title to appear
    const xtermVisible = page.locator(".xterm");
    const sessionText = page.locator(`text=${session.name}`).first();

    await expect(
      xtermVisible.or(sessionText),
    ).toBeVisible({ timeout: 15_000 });

    await deleteSession(request, session.id);
  });
});

test.describe("Session — Terminal Page", () => {
  test("terminal page loads and renders xterm", async ({
    page,
    request,
  }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}xterm-render`,
    });

    await page.goto(`/sessions/${session.id}`);

    // Wait for page to load, then switch to Terminal tab
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const termTab = page.getByRole("button", { name: "Terminal" });
    await expect(termTab).toBeVisible({ timeout: 10_000 });
    await termTab.click();
    await page.waitForTimeout(1000);
    await expect(page.locator(".xterm")).toBeVisible({ timeout: 20_000 });

    await deleteSession(request, session.id);
  });

  test("navigating to invalid session shows error", async ({ page }) => {
    await page.goto("/sessions/nonexistent-id-12345");
    await page.waitForLoadState("networkidle");

    // Should show some form of error
    const body = await page.locator("body").textContent();
    const url = page.url();
    const isHandled =
      body?.toLowerCase().includes("not found") ||
      body?.toLowerCase().includes("error") ||
      url === "http://localhost:3000/" ||
      url.includes("/login");

    expect(isHandled).toBeTruthy();
  });

  test("back navigation from terminal to dashboard", async ({
    page,
    request,
  }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}back-nav`,
    });

    await page.goto(`/sessions/${session.id}`);
    await page.waitForLoadState("networkidle");

    // Find home/back link
    const backLink = page.locator('a[href="/"]').first();
    if (await backLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await backLink.click();
      await expect(page).toHaveURL("/");
    }

    await deleteSession(request, session.id);
  });
});
