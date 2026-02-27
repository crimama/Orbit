import type { IPty } from "node-pty";

// --- Socket.io Event Contracts ---

export interface ServerToClientEvents {
  "terminal-data": (data: string) => void;
  "terminal-data-compressed": (data: Buffer) => void;
  "session-update": (session: SessionInfo) => void;
  "session-list": (sessions: SessionInfo[]) => void;
  "session-exit": (sessionId: string, exitCode: number) => void;
  // Phase 2: SSH
  "ssh-status": (status: SshConnectionStatus) => void;
  // Phase 3: Skill Graph
  "graph-state": (state: GraphState) => void;
  "skill-trace": (trace: SkillTrace) => void;
  // Phase 4: Interceptor
  "interceptor-pending": (approval: PendingApproval) => void;
  "interceptor-resolved": (approvalId: string, approved: boolean) => void;
  "interceptor-warn": (warning: InterceptorWarning) => void;
}

export interface ClientToServerEvents {
  "terminal-data": (data: string) => void;
  "terminal-resize": (size: { cols: number; rows: number }) => void;
  "session-attach": (
    sessionId: string,
    callback: (res: { ok: boolean; error?: string }) => void,
  ) => void;
  "session-detach": () => void;
  "session-list": (
    projectId: string | null,
    callback: (sessions: SessionInfo[]) => void,
  ) => void;
  // Phase 2: SSH
  "ssh-connect": (
    configId: string,
    callback: (res: { ok: boolean; error?: string }) => void,
  ) => void;
  "ssh-disconnect": (configId: string) => void;
  "ssh-status-request": (
    configId: string,
    callback: (status: SshConnectionStatus) => void,
  ) => void;
  // Phase 3: Skill Graph
  "graph-subscribe": (
    projectId: string,
    callback: (state: GraphState) => void,
  ) => void;
  "graph-unsubscribe": (projectId: string) => void;
  // Phase 4: Interceptor
  "interceptor-approve": (approvalId: string) => void;
  "interceptor-deny": (approvalId: string) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  attachedSessionId: string | null;
  subscribedGraphProjectId?: string | null;
}

// --- PTY Session (in-memory) ---

export interface PtySession {
  id: string;
  process: IPty;
  cols: number;
  rows: number;
  lastActivity: number;
  cwd: string;
}

// --- Session Info (API response) ---

export type SessionStatus = "active" | "paused" | "terminated";

export interface SessionInfo {
  id: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  name: string | null;
  agentType: string;
  sessionRef: string;
  status: SessionStatus;
  lastContext: string | null;
  createdAt: string;
  updatedAt: string;
  source?: "orbit" | "claude-history";
}

// --- Project Info (API response) ---

export type ProjectType = "LOCAL" | "SSH" | "DOCKER";

export interface ProjectInfo {
  id: string;
  name: string;
  type: ProjectType;
  color: string;
  path: string;
  sshConfigId?: string | null;
  dockerContainer?: string | null;
  sessionCount: number;
  createdAt: string;
  updatedAt: string;
}

// --- API Request/Response ---

export interface CreateProjectRequest {
  name: string;
  type: ProjectType;
  color?: string;
  path: string;
  sshConfigId?: string;
  dockerContainer?: string;
}

export interface CreateSessionRequest {
  projectId: string;
  agentType: string;
  name?: string;
  cols?: number;
  rows?: number;
  resumeSessionRef?: string;
}

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
}

// --- Filesystem Browse ---

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

export interface BrowseResponse {
  current: string;
  parent: string | null;
  entries: DirEntry[];
}

export interface DockerContainerInfo {
  id: string;
  name: string;
  status: string;
}

export interface ProjectAgentInfo {
  id: string;
  projectId: string;
  name: string;
  agentType: "terminal" | "claude-code" | "codex";
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectAgentRequest {
  projectId: string;
  name: string;
  agentType: "terminal" | "claude-code" | "codex";
}

// --- Phase 2: SSH & PWA ---

export interface SshConfigInfo {
  id: string;
  label?: string | null;
  tags?: string | null;
  host: string;
  port: number;
  username: string;
  authMethod: "key" | "password";
  keyPath: string | null;
  defaultPath?: string | null;
  defaultDockerContainer?: string | null;
  proxyConfigId?: string | null;
  createdAt: string;
}

export type SshConnectionState = "disconnected" | "connecting" | "connected" | "error";

export interface SshConnectionStatus {
  configId: string;
  state: SshConnectionState;
  error?: string;
}

export interface CreateSshConfigRequest {
  label?: string;
  tags?: string;
  host: string;
  port?: number;
  username: string;
  authMethod: "key" | "password";
  keyPath?: string;
  password?: string;
  defaultPath?: string;
  defaultDockerContainer?: string;
  proxyConfigId?: string | null;
}

// --- Phase 3: Skill Graph ---

export type SkillNodeStatus = "idle" | "running" | "success" | "error";

export interface SkillNodeInfo {
  id: string;
  projectId: string | null;
  name: string;
  description: string | null;
  mcpEndpoint: string | null;
  config: string;
  posX: number;
  posY: number;
  nodeType: string;
  status?: SkillNodeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SkillEdgeInfo {
  id: string;
  sourceId: string;
  targetId: string;
  label: string | null;
  animated: boolean;
  createdAt: string;
}

export interface GraphState {
  projectId: string;
  nodes: SkillNodeInfo[];
  edges: SkillEdgeInfo[];
  readOnly?: boolean;
  source?: "db" | "skill_graph_fs";
}

export interface SkillTrace {
  skillId: string;
  projectId: string;
  status: SkillNodeStatus;
  timestamp: string;
}

export interface CreateSkillRequest {
  projectId: string;
  name: string;
  description?: string;
  mcpEndpoint?: string;
  nodeType?: string;
  posX?: number;
  posY?: number;
}

export interface UpdateSkillRequest {
  name?: string;
  description?: string;
  mcpEndpoint?: string;
  config?: string;
  posX?: number;
  posY?: number;
  nodeType?: string;
}

export interface CreateSkillEdgeRequest {
  sourceId: string;
  targetId: string;
  label?: string;
  animated?: boolean;
}

// --- Phase 4: Interceptor & Delta ---

export type InterceptorSeverity = "warn" | "block";

export interface InterceptorRuleInfo {
  id: string;
  pattern: string;
  description: string;
  severity: InterceptorSeverity;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PendingApproval {
  id: string;
  sessionId: string;
  command: string;
  matchedRule: InterceptorRuleInfo;
  timestamp: string;
}

export interface InterceptorWarning {
  sessionId: string;
  command: string;
  matchedRule: InterceptorRuleInfo;
  timestamp: string;
}

export interface CreateInterceptorRuleRequest {
  pattern: string;
  description: string;
  severity?: InterceptorSeverity;
  enabled?: boolean;
}
