import { test, expect } from "@playwright/test";
import {
  createProject,
  createSession,
  deleteProject,
  deleteSession,
  listSessions,
} from "./helpers/api";
import { cleanupTestData } from "./helpers/cleanup";
import { mkdirSync } from "fs";

const PREFIX = `e2e-test-mobile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-`;
let projectId = "";

test.beforeAll(async ({ request }) => {
  mkdirSync("/tmp/e2e-mobile-project", { recursive: true });
  await cleanupTestData(request, PREFIX);
  const project = await createProject(request, {
    name: `${PREFIX}project`,
    type: "LOCAL",
    path: "/tmp/e2e-mobile-project",
  });
  projectId = project.id;
});

test.afterAll(async ({ request }) => {
  await cleanupTestData(request, PREFIX);
  if (projectId) {
    await deleteProject(request, projectId).catch(() => {});
  }
});

test.describe("Mobile mode /m", () => {
  test("@route-shell renders mobile route shell", async ({ page }) => {
    await page.goto("/m");
    await expect(page.getByTestId("mobile-route-shell")).toBeVisible();
  });

  test("@desktop-smoke desktop dashboard still loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Orbit/i);
    await expect(page.getByText("Projects").first()).toBeVisible();
  });

  test("@mobile-start-stop starts a mobile session and returns to controls on stop", async ({
    page,
    request,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.goto("/m");

    const projectCard = page.getByTestId(`mobile-project-card-${projectId}`);
    await expect(projectCard).toBeVisible({ timeout: 10_000 });
    await projectCard.click();
    await page.getByTestId("mobile-agent-select").selectOption("terminal");

    const startButton = page.getByTestId("mobile-start-button");
    await expect(startButton).toBeEnabled();
    await startButton.click();

    await expect(page.getByTestId("mobile-chat-shell")).toBeVisible({
      timeout: 15_000,
    });

    const sessions = await listSessions(request, projectId);
    const active = sessions.find((session) => session.status === "active");
    expect(active).toBeTruthy();

    await page.getByTestId("mobile-stop-button").first().click();
    await expect(page.getByTestId("mobile-session-controls")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("@mobile-duplicate-stop disables stop while termination is in flight", async ({
    page,
    request,
  }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}duplicate-stop`,
    });

    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.goto("/m");

    await page.getByTestId(`mobile-project-card-${projectId}`).click();
    await page.getByTestId("mobile-reenter-button").click();
    await expect(page.getByTestId("mobile-chat-shell")).toBeVisible({
      timeout: 15_000,
    });

    await page.route(`**/api/sessions/${session.id}`, async (route) => {
      if (route.request().method() !== "DELETE") {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });

    const stopButton = page.getByTestId("mobile-stop-button").first();
    await stopButton.click();
    await expect(stopButton).toBeDisabled();
    await expect(page.getByTestId("mobile-session-controls")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("@mobile-chat-flow sends a terminal-backed message through the mobile chat shell", async ({
    page,
    request,
  }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}chat-flow`,
    });

    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.goto("/m");

    await page.getByTestId(`mobile-project-card-${projectId}`).click();
    await page.getByTestId("mobile-reenter-button").click();

    await expect(page.getByTestId("mobile-chat-shell")).toBeVisible({
      timeout: 15_000,
    });

    const input = page.getByRole("textbox");
    await expect(input).toBeEnabled({ timeout: 15_000 });
    await input.fill("echo hello-mobile");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByText("hello-mobile")).toBeVisible({
      timeout: 15_000,
    });

    await deleteSession(request, session.id);
  });

  test("@mobile-reenter re-enters an existing active session without creating a duplicate", async ({
    page,
    request,
  }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}reenter`,
    });

    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.goto("/m");

    await page.getByTestId(`mobile-project-card-${projectId}`).click();
    await page.getByTestId("mobile-reenter-button").click();

    await expect(page.getByTestId("mobile-chat-shell")).toBeVisible({
      timeout: 15_000,
    });

    const sessions = await listSessions(request, projectId);
    const matching = sessions.filter((item) => item.id === session.id);
    expect(matching).toHaveLength(1);

    await deleteSession(request, session.id);
  });

  test("@mobile-start-failure surfaces start errors and keeps the user on controls", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.route("**/api/sessions", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "start failed" }),
      });
    });

    await page.goto("/m");
    await page.getByTestId(`mobile-project-card-${projectId}`).click();
    await page.getByTestId("mobile-agent-select").selectOption("terminal");
    await page.getByTestId("mobile-start-button").click();

    await expect(page.getByTestId("mobile-error")).toContainText(
      "start failed",
    );
    await expect(page.getByTestId("mobile-session-controls")).toBeVisible();
  });

  test("@mobile-reconnect keeps the chat shell mounted across offline and reconnect", async ({
    page,
    context,
    request,
  }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}reconnect`,
    });

    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.goto("/m");

    await page.getByTestId(`mobile-project-card-${projectId}`).click();
    await page.getByTestId("mobile-reenter-button").click();
    await expect(page.getByTestId("mobile-chat-shell")).toBeVisible({
      timeout: 15_000,
    });

    await context.setOffline(true);
    await expect(page.getByTestId("mobile-network-state")).toContainText(
      "Offline",
      {
        timeout: 10_000,
      },
    );
    await expect(page.getByTestId("mobile-chat-shell")).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByTestId("mobile-network-state")).not.toContainText(
      "Offline",
      {
        timeout: 15_000,
      },
    );
    await expect(page.getByTestId("mobile-chat-shell")).toBeVisible();

    await deleteSession(request, session.id);
  });

  test("@mobile-happy completes the mobile happy path", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.goto("/m");

    await page.getByTestId(`mobile-project-card-${projectId}`).click();
    await page.getByTestId("mobile-agent-select").selectOption("terminal");
    await page.getByTestId("mobile-start-button").click();
    await expect(page.getByTestId("mobile-chat-shell")).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId("mobile-stop-button").first().click();
    await expect(page.getByTestId("mobile-session-controls")).toBeVisible({
      timeout: 10_000,
    });
  });
});
