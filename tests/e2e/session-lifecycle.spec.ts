import { test, expect } from "@playwright/test";
import {
  createProject,
  createSession,
  deleteProject,
  deleteSession,
} from "./helpers/api";
import { cleanupTestData } from "./helpers/cleanup";

const PREFIX = "e2e-test-life-";
let projectId: string;

test.beforeAll(async ({ request }) => {
  await cleanupTestData(request, PREFIX);
  const project = await createProject(request, {
    name: `${PREFIX}parent`,
    type: "LOCAL",
    path: "/tmp/e2e-lifecycle",
  });
  projectId = project.id;
});

test.afterAll(async ({ request }) => {
  await cleanupTestData(request, PREFIX);
});

test.describe("Session Lifecycle — Status Transitions", () => {
  test("new session starts as active", async ({ request }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}status-active`,
    });

    expect(session.status).toBe("active");
    await deleteSession(request, session.id);
  });

  test("session becomes terminated after DELETE", async ({ request }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}status-term`,
    });

    await deleteSession(request, session.id);

    const res = await request.get(`/api/sessions/${session.id}`);
    const json = await res.json();
    expect(json.data.status).toBe("terminated");
  });

  test("terminated session cannot be terminated again (idempotent)", async ({
    request,
  }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}double-term`,
    });

    await deleteSession(request, session.id);

    const res = await request.delete(`/api/sessions/${session.id}`);
    expect(res.status()).toBeLessThan(500);
  });

  test("session GET returns full session info", async ({ request }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}get-info`,
    });

    const res = await request.get(`/api/sessions/${session.id}`);
    expect(res.ok()).toBe(true);
    const json = await res.json();

    expect(json.data).toMatchObject({
      id: session.id,
      agentType: "terminal",
      name: `${PREFIX}get-info`,
    });

    await deleteSession(request, session.id);
  });
});

test.describe("Session Lifecycle — Agent Types", () => {
  const agentTypes = ["terminal", "claude-code", "codex", "opencode"] as const;

  for (const agentType of agentTypes) {
    test(`creates ${agentType} session successfully`, async ({ request }) => {
      const session = await createSession(request, {
        projectId,
        agentType,
        name: `${PREFIX}agent-${agentType}`,
      });

      expect(session.agentType).toBe(agentType);
      expect(session.status).toBe("active");

      await deleteSession(request, session.id);
    });
  }
});

test.describe("Session Lifecycle — Concurrent Sessions", () => {
  test("multiple active sessions for same project coexist", async ({
    request,
  }) => {
    const sessions = await Promise.all([
      createSession(request, {
        projectId,
        agentType: "terminal",
        name: `${PREFIX}conc-1`,
      }),
      createSession(request, {
        projectId,
        agentType: "terminal",
        name: `${PREFIX}conc-2`,
      }),
    ]);

    expect(sessions).toHaveLength(2);
    expect(sessions[0].status).toBe("active");
    expect(sessions[1].status).toBe("active");

    await Promise.all(sessions.map((s) => deleteSession(request, s.id)));
  });

  test("terminating one session does not affect others", async ({
    request,
  }) => {
    const [s1, s2] = await Promise.all([
      createSession(request, {
        projectId,
        agentType: "terminal",
        name: `${PREFIX}iso-1`,
      }),
      createSession(request, {
        projectId,
        agentType: "terminal",
        name: `${PREFIX}iso-2`,
      }),
    ]);

    await deleteSession(request, s1.id);

    const res = await request.get(`/api/sessions/${s2.id}`);
    const json = await res.json();
    expect(json.data.status).toBe("active");

    await deleteSession(request, s2.id);
  });
});

test.describe("Session Lifecycle — Name Handling", () => {
  test("session with empty name gets created", async ({ request }) => {
    const res = await request.post("/api/sessions", {
      data: { projectId, agentType: "terminal" },
    });
    const json = await res.json();
    expect(json.data.id).toBeTruthy();

    await deleteSession(request, json.data.id);
  });

  test("session name with special characters is preserved", async ({
    request,
  }) => {
    const specialName = `${PREFIX}special-!@#$%^&*()`;
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: specialName,
    });

    const res = await request.get(`/api/sessions/${session.id}`);
    const json = await res.json();
    expect(json.data.name).toBe(specialName);

    await deleteSession(request, session.id);
  });

  test("session name with unicode is preserved", async ({ request }) => {
    const unicodeName = `${PREFIX}세션-テスト`;
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: unicodeName,
    });

    const res = await request.get(`/api/sessions/${session.id}`);
    const json = await res.json();
    expect(json.data.name).toBe(unicodeName);

    await deleteSession(request, session.id);
  });

  test("rename clears name when set to empty string", async ({ request }) => {
    const session = await createSession(request, {
      projectId,
      agentType: "terminal",
      name: `${PREFIX}clear-name`,
    });

    await request.patch(`/api/sessions/${session.id}`, {
      data: { name: "" },
    });

    const res = await request.get(`/api/sessions/${session.id}`);
    const json = await res.json();
    expect(json.data.name === "" || json.data.name === null).toBeTruthy();

    await deleteSession(request, session.id);
  });
});
