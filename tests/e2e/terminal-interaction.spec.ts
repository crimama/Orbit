import { test, expect, type Page } from "@playwright/test";
import { createProject, createSession, deleteSession } from "./helpers/api";
import { cleanupTestData } from "./helpers/cleanup";
import { execSync } from "child_process";

const PREFIX = "e2e-test-term-";
const PROJECT_PATH = "/tmp/e2e-terminal-interact";
let projectId: string;

/** Navigate to session and activate Terminal tab, wait for xterm */
async function openTerminal(page: Page, sessionId: string) {
  await page.goto(`/sessions/${sessionId}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  const termTab = page.getByRole("button", { name: "Terminal" });
  await expect(termTab).toBeVisible({ timeout: 10_000 });
  await termTab.click();
  await page.waitForTimeout(1000);
  await expect(page.locator(".xterm")).toBeVisible({ timeout: 20_000 });
}

test.beforeAll(async ({ request }) => {
  execSync(`mkdir -p ${PROJECT_PATH}`);
  await cleanupTestData(request, PREFIX);
  const project = await createProject(request, {
    name: `${PREFIX}parent`,
    type: "LOCAL",
    path: PROJECT_PATH,
  });
  projectId = project.id;
});

test.afterAll(async ({ request }) => {
  await cleanupTestData(request, PREFIX);
});

test.describe("Terminal Interaction — Connection", () => {
  test("terminal connects and renders xterm", async ({ page, request }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}shell-prompt`,
    });

    await openTerminal(page, session.id);

    // Terminal canvas should be rendered
    const canvas = page.locator(".xterm canvas").first();
    await expect(canvas).toBeVisible();

    await deleteSession(request, session.id);
  });

  test("terminal accepts keyboard input", async ({ page, request }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}keyboard`,
    });

    await openTerminal(page, session.id);

    // Wait for shell ready
    await page.waitForTimeout(2000);

    // Type a command
    const xtermEl = page.locator(".xterm-helper-textarea").first();
    if (await xtermEl.isVisible().catch(() => false)) {
      await xtermEl.type("echo hello-e2e\n");
    } else {
      await page.locator(".xterm").first().click();
      await page.keyboard.type("echo hello-e2e\n");
    }

    await page.waitForTimeout(2000);

    // Terminal should still be visible and not crashed
    await expect(page.locator(".xterm")).toBeVisible();

    await deleteSession(request, session.id);
  });

  test("terminal handles resize", async ({ page, request }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}resize`,
    });

    await openTerminal(page, session.id);

    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(500);

    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);

    await expect(page.locator(".xterm")).toBeVisible();

    await deleteSession(request, session.id);
  });
});

test.describe("Terminal Interaction — Session Persistence", () => {
  test("re-visiting session page re-attaches to terminal", async ({
    page,
    request,
  }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}reattach`,
    });

    // First visit
    await openTerminal(page, session.id);

    // Navigate away
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Come back — Terminal tab state may persist or need re-activation
    await openTerminal(page, session.id);

    await deleteSession(request, session.id);
  });

  test("terminated session page does not crash", async ({
    page,
    request,
  }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}exit-msg`,
    });

    // Open terminal page
    await page.goto(`/sessions/${session.id}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // Terminate via API
    await deleteSession(request, session.id);

    // Wait for session-exit event
    await page.waitForTimeout(3000);

    // Page should still be visible (not crashed)
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Terminal Interaction — Multiple Sessions", () => {
  test("different sessions have different URLs", async ({
    page,
    request,
  }) => {
    const [s1, s2] = await Promise.all([
      createSession(request, {
        projectId,
        agentType: "terminal",
        name: `${PREFIX}multi-1`,
      }),
      createSession(request, {
        projectId,
        agentType: "terminal",
        name: `${PREFIX}multi-2`,
      }),
    ]);

    await page.goto(`/sessions/${s1.id}`);
    const firstUrl = page.url();

    await page.goto(`/sessions/${s2.id}`);
    const secondUrl = page.url();

    expect(firstUrl).not.toBe(secondUrl);
    expect(firstUrl).toContain(s1.id);
    expect(secondUrl).toContain(s2.id);

    await Promise.all([
      deleteSession(request, s1.id),
      deleteSession(request, s2.id),
    ]);
  });
});

test.describe("Terminal Interaction — Edge Cases", () => {
  test("rapid navigation between sessions does not crash", async ({
    page,
    request,
  }) => {
    const sessions = await Promise.all(
      [1, 2, 3].map((i) =>
        createSession(request, {
          projectId,
          agentType: "terminal",
          name: `${PREFIX}rapid-${i}`,
        }),
      ),
    );

    for (const s of sessions) {
      await page.goto(`/sessions/${s.id}`);
      await page.waitForTimeout(500);
    }

    // Last one should be visible
    await expect(page.locator("body")).toBeVisible();

    await Promise.all(sessions.map((s) => deleteSession(request, s.id)));
  });

  test("very long session name is handled", async ({ page, request }) => {
    const longName = `${PREFIX}${"a".repeat(200)}`;
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: longName,
    });

    await page.goto(`/sessions/${session.id}`);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).toBeVisible();

    await deleteSession(request, session.id);
  });
});
