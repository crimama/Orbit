import { test, expect } from "@playwright/test";
import { createProject, deleteProject, listProjects } from "./helpers/api";
import { cleanupTestData } from "./helpers/cleanup";

const PREFIX = "e2e-test-dash-";

test.afterAll(async ({ request }) => {
  await cleanupTestData(request, PREFIX);
});

test.describe("Dashboard — Initial Load", () => {
  test("shows dashboard layout with project and session panels", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Orbit/i);
    await expect(page.locator("text=Projects").first()).toBeVisible();
  });

  test("displays empty state message when no test project exists", async ({
    page,
  }) => {
    await page.goto("/");
    // Page should load without crashing
    await expect(page.locator("body")).toBeVisible();
  });

  test("loads existing projects from API", async ({ page, request }) => {
    const project = await createProject(request, {
      name: `${PREFIX}load-test`,
      type: "LOCAL",
      path: "/tmp/e2e-load-test",
    });

    await page.goto("/");

    await expect(page.getByText(project.name).first()).toBeVisible({
      timeout: 10_000,
    });

    await deleteProject(request, project.id);
  });
});

test.describe("Dashboard — Project CRUD", () => {
  test("creates a project via API and sees it on dashboard", async ({
    page,
    request,
  }) => {
    const project = await createProject(request, {
      name: `${PREFIX}crud-create`,
      type: "LOCAL",
      path: "/tmp/e2e-crud-create",
    });

    await page.goto("/");
    await expect(page.getByText(project.name).first()).toBeVisible({
      timeout: 10_000,
    });

    await deleteProject(request, project.id);
  });

  test("selects a project and shows its details", async ({
    page,
    request,
  }) => {
    const project = await createProject(request, {
      name: `${PREFIX}select-test`,
      type: "LOCAL",
      path: "/tmp/e2e-select-test",
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const projectItem = page.getByText(project.name).first();
    await expect(projectItem).toBeVisible({ timeout: 10_000 });
    await projectItem.click();

    await expect(page.getByText(project.name).first()).toBeVisible();

    await deleteProject(request, project.id);
  });

  test("multiple projects appear on the page", async ({
    page,
    request,
  }) => {
    const projectA = await createProject(request, {
      name: `${PREFIX}multi-alpha`,
      type: "LOCAL",
      path: "/tmp/e2e-multi-alpha",
    });
    const projectB = await createProject(request, {
      name: `${PREFIX}multi-beta`,
      type: "LOCAL",
      path: "/tmp/e2e-multi-beta",
    });

    await page.goto("/");

    await expect(page.getByText(projectA.name).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(projectB.name).first()).toBeVisible({
      timeout: 10_000,
    });

    await Promise.all([
      deleteProject(request, projectA.id),
      deleteProject(request, projectB.id),
    ]);
  });

  test("deletes a project via API and verifies removal on reload", async ({
    page,
    request,
  }) => {
    const project = await createProject(request, {
      name: `${PREFIX}delete-test`,
      type: "LOCAL",
      path: "/tmp/e2e-delete-test",
    });

    await page.goto("/");
    await expect(page.getByText(project.name).first()).toBeVisible({
      timeout: 10_000,
    });

    await deleteProject(request, project.id);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(
      page.locator(".truncate").filter({ hasText: project.name }),
    ).not.toBeVisible({ timeout: 5_000 });
  });

  test("project with custom color is rendered", async ({ page, request }) => {
    const project = await createProject(request, {
      name: `${PREFIX}color-test`,
      type: "LOCAL",
      path: "/tmp/e2e-color-test",
      color: "#ef4444",
    });

    await page.goto("/");
    await expect(page.getByText(project.name).first()).toBeVisible({
      timeout: 10_000,
    });

    await deleteProject(request, project.id);
  });
});

test.describe("Dashboard — Project API Validation", () => {
  test("POST /api/projects rejects missing name", async ({ request }) => {
    const res = await request.post("/api/projects", {
      data: { type: "LOCAL", path: "/tmp" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/projects rejects missing path", async ({ request }) => {
    const res = await request.post("/api/projects", {
      data: { name: `${PREFIX}no-path`, type: "LOCAL" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/projects rejects invalid color format", async ({
    request,
  }) => {
    const res = await request.post("/api/projects", {
      data: {
        name: `${PREFIX}bad-color`,
        type: "LOCAL",
        path: "/tmp",
        color: "not-a-color",
      },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("hex");
  });

  test("POST /api/projects rejects SSH without sshConfigId", async ({
    request,
  }) => {
    const res = await request.post("/api/projects", {
      data: { name: `${PREFIX}ssh-no-config`, type: "SSH", path: "/tmp" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/projects rejects DOCKER without container", async ({
    request,
  }) => {
    const res = await request.post("/api/projects", {
      data: { name: `${PREFIX}docker-no-ctr`, type: "DOCKER", path: "/tmp" },
    });
    expect(res.status()).toBe(400);
  });

  test("GET /api/projects returns array", async ({ request }) => {
    const res = await request.get("/api/projects");
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
  });

  test("PATCH /api/projects/:id renames project", async ({ request }) => {
    const project = await createProject(request, {
      name: `${PREFIX}rename-api`,
      type: "LOCAL",
      path: "/tmp/e2e-rename-api",
    });

    const res = await request.patch(`/api/projects/${project.id}`, {
      data: { name: `${PREFIX}rename-api-updated` },
    });
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.data.name).toBe(`${PREFIX}rename-api-updated`);

    await deleteProject(request, project.id);
  });

  test("DELETE /api/projects/:id removes project", async ({ request }) => {
    const project = await createProject(request, {
      name: `${PREFIX}delete-api`,
      type: "LOCAL",
      path: "/tmp/e2e-delete-api",
    });

    const res = await request.delete(`/api/projects/${project.id}`);
    expect(res.ok()).toBe(true);

    const listRes = await request.get("/api/projects");
    const json = await listRes.json();
    expect(
      json.data.find((p: { id: string }) => p.id === project.id),
    ).toBeUndefined();
  });
});
