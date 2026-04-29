import type { APIRequestContext } from "@playwright/test";
import {
  listProjects,
  listSessions,
  deleteProject,
  deleteSession,
} from "./api";

const DEFAULT_PREFIX = "e2e-test-";

/** Remove all projects and sessions created by E2E tests */
export async function cleanupTestData(
  request: APIRequestContext,
  prefix: string = DEFAULT_PREFIX,
) {
  const [projects, sessions] = await Promise.all([
    listProjects(request).catch(() => []),
    listSessions(request).catch(() => []),
  ]);

  const testSessions = (sessions ?? []).filter((s) =>
    s.name?.startsWith(prefix),
  );
  const testProjects = (projects ?? []).filter((p) =>
    p.name?.startsWith(prefix),
  );

  const testProjectIds = new Set(testProjects.map((project) => project.id));
  const projectScopedSessions = (sessions ?? []).filter((session) =>
    testProjectIds.has(session.projectId),
  );
  const sessionIds = new Set([
    ...testSessions.map((session) => session.id),
    ...projectScopedSessions.map((session) => session.id),
  ]);

  await Promise.all(
    Array.from(sessionIds).map((id) =>
      deleteSession(request, id).catch(() => {}),
    ),
  );
  await Promise.all(
    testProjects.map((p) => deleteProject(request, p.id).catch(() => {})),
  );
}
