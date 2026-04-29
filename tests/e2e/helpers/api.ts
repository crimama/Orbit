import type { APIRequestContext } from "@playwright/test";

export interface ProjectPayload {
  name: string;
  type: "LOCAL" | "SSH" | "DOCKER";
  path: string;
  color?: string;
}

export interface SessionPayload {
  projectId: string;
  agentType: "terminal" | "claude-code" | "codex" | "opencode";
  name?: string;
}

export async function createProject(
  request: APIRequestContext,
  payload: ProjectPayload,
) {
  const res = await request.post("/api/projects", { data: payload });
  const json = await res.json();
  return json.data as { id: string; name: string; path: string };
}

export async function deleteProject(request: APIRequestContext, id: string) {
  await request.delete(`/api/projects/${id}`);
}

export async function createSession(
  request: APIRequestContext,
  payload: SessionPayload,
) {
  const res = await request.post("/api/sessions", { data: payload });
  const json = await res.json();
  return json.data as {
    id: string;
    name: string;
    agentType: string;
    status: string;
  };
}

export async function deleteSession(request: APIRequestContext, id: string) {
  await request.delete(`/api/sessions/${id}`);
}

export async function listSessions(
  request: APIRequestContext,
  projectId?: string,
) {
  const url = projectId
    ? `/api/sessions?projectId=${projectId}`
    : "/api/sessions";
  const res = await request.get(url);
  const json = await res.json();
  return json.data as Array<{
    id: string;
    projectId: string;
    name: string | null;
    status: string;
  }>;
}

export async function listProjects(request: APIRequestContext) {
  const res = await request.get("/api/projects");
  const json = await res.json();
  return json.data as Array<{ id: string; name: string }>;
}
