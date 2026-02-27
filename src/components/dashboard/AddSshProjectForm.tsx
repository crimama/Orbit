"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import RemoteDirectoryPicker from "./RemoteDirectoryPicker";
import type {
  ProjectInfo,
  SshConfigInfo,
  DockerContainerInfo,
  CreateSshConfigRequest,
  ApiResponse,
  ApiError,
} from "@/lib/types";

interface AddSshProjectFormProps {
  onCreated?: (project: ProjectInfo) => void;
  onSaved?: (configId: string) => void;
  initialProfileId?: string | null;
  editingProfileId?: string | null;
  mode?: "project" | "vault";
}

type SshTarget = "host" | "docker";

export default function AddSshProjectForm({
  onCreated,
  onSaved,
  initialProfileId,
  editingProfileId,
  mode = "project",
}: AddSshProjectFormProps) {
  type JumpMode = "none" | "existing" | "manual";
  const isVaultMode = mode === "vault";

  const [name, setName] = useState("");
  const [profileId, setProfileId] = useState("");
  const [label, setLabel] = useState("");
  const [tags, setTags] = useState("");
  const [color, setColor] = useState("#f59e0b");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [authMethod, setAuthMethod] = useState<"key" | "password">("key");
  const [keyPath, setKeyPath] = useState("~/.ssh/id_rsa");
  const [password, setPassword] = useState("");
  const [jumpMode, setJumpMode] = useState<JumpMode>("none");
  const [existingProxyConfigId, setExistingProxyConfigId] = useState("");
  const [jumpHost, setJumpHost] = useState("");
  const [jumpPort, setJumpPort] = useState("22");
  const [jumpUsername, setJumpUsername] = useState("");
  const [jumpAuthMethod, setJumpAuthMethod] = useState<"key" | "password">(
    "key",
  );
  const [jumpKeyPath, setJumpKeyPath] = useState("~/.ssh/id_rsa");
  const [jumpPassword, setJumpPassword] = useState("");
  const [target, setTarget] = useState<SshTarget>("host");
  const [dockerContainer, setDockerContainer] = useState("");
  const [defaultPath, setDefaultPath] = useState("");
  const [defaultDockerContainer, setDefaultDockerContainer] = useState("");
  const [dockerContainers, setDockerContainers] = useState<DockerContainerInfo[]>(
    [],
  );
  const [loadingDockerContainers, setLoadingDockerContainers] = useState(false);
  const [remotePath, setRemotePath] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    error?: string;
  } | null>(null);
  const [testedConfigId, setTestedConfigId] = useState<string | null>(null);
  const [testedProxyConfigId, setTestedProxyConfigId] = useState<string | null>(
    null,
  );
  const [showRemotePicker, setShowRemotePicker] = useState(false);
  const [sshConfigs, setSshConfigs] = useState<SshConfigInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const testedConfigIdRef = useRef<string | null>(null);
  const testedProxyConfigIdRef = useRef<string | null>(null);
  const keepTestedConfigRef = useRef(false);

  function invalidateTest() {
    setTestResult(null);
    setTestedConfigId(null);
    setTestedProxyConfigId(null);
    setTarget("host");
    setDockerContainers([]);
    setDockerContainer("");
  }

  async function createSshConfig(
    payload: CreateSshConfigRequest,
  ): Promise<string> {
    const res = await fetch("/api/ssh-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as ApiResponse<SshConfigInfo> | ApiError;
    if ("error" in json) {
      throw new Error(json.error);
    }
    return json.data.id;
  }

  useEffect(() => {
    async function fetchSshConfigs() {
      try {
        const res = await fetch("/api/ssh-configs");
        const json = (await res.json()) as ApiResponse<SshConfigInfo[]>;
        if ("data" in json) setSshConfigs(json.data);
      } catch {
        // Ignore load failures for proxy options.
      }
    }
    fetchSshConfigs();
  }, []);

  const applyProfile = useCallback((configId: string) => {
    setProfileId(configId);
    const config = sshConfigs.find((c) => c.id === configId);
    if (!config) return;

    setLabel(config.label ?? "");
    setTags(config.tags ?? "");
    setHost(config.host);
    setPort(String(config.port));
    setUsername(config.username);
    setAuthMethod(config.authMethod);
    setKeyPath(config.keyPath ?? "~/.ssh/id_rsa");
    setPassword("");
    setDefaultPath(config.defaultPath ?? "");
    setDefaultDockerContainer(config.defaultDockerContainer ?? "");
    setRemotePath(config.defaultPath ?? "");
    if (config.proxyConfigId) {
      setJumpMode("existing");
      setExistingProxyConfigId(config.proxyConfigId);
    } else {
      setJumpMode("none");
      setExistingProxyConfigId("");
    }
    if (config.defaultDockerContainer) {
      setTarget("docker");
      setDockerContainer(config.defaultDockerContainer);
    } else {
      setTarget("host");
      setDockerContainer("");
    }
    invalidateTest();
  }, [sshConfigs]);

  useEffect(() => {
    if (!initialProfileId || sshConfigs.length === 0) return;
    if (profileId === initialProfileId) return;
    applyProfile(initialProfileId);
  }, [initialProfileId, sshConfigs, profileId, applyProfile]);

  const loadRemoteDockerContainers = useCallback(async () => {
    if (!testedConfigId) return;
    setLoadingDockerContainers(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/ssh-configs/${testedConfigId}/docker/containers`,
      );
      const json = (await res.json()) as
        | ApiResponse<DockerContainerInfo[]>
        | ApiError;
      if ("error" in json) {
        setError(json.error);
      } else {
        setDockerContainers(json.data);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch remote docker containers",
      );
    } finally {
      setLoadingDockerContainers(false);
    }
  }, [testedConfigId]);

  // Auto-load containers when Docker target is selected
  useEffect(() => {
    if (target === "docker" && testedConfigId && dockerContainers.length === 0) {
      loadRemoteDockerContainers();
    }
  }, [target, testedConfigId, dockerContainers.length, loadRemoteDockerContainers]);

  useEffect(() => {
    testedConfigIdRef.current = testedConfigId;
  }, [testedConfigId]);

  useEffect(() => {
    testedProxyConfigIdRef.current = testedProxyConfigId;
  }, [testedProxyConfigId]);

  useEffect(() => {
    return () => {
      if (keepTestedConfigRef.current) return;
      const ids = [testedConfigIdRef.current, testedProxyConfigIdRef.current].filter(
        (v): v is string => !!v,
      );
      ids.forEach((id) => {
        void fetch(`/api/ssh-configs/${id}`, {
          method: "DELETE",
          keepalive: true,
        });
      });
    };
  }, []);

  async function handleTestConnection() {
    if (!host.trim() || !username.trim()) return;
    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      if (testedConfigId) {
        await fetch(`/api/ssh-configs/${testedConfigId}`, { method: "DELETE" });
        setTestedConfigId(null);
      }
      if (testedProxyConfigId) {
        await fetch(`/api/ssh-configs/${testedProxyConfigId}`, {
          method: "DELETE",
        });
        setTestedProxyConfigId(null);
      }

      let effectiveProxyId: string | undefined;
      if (jumpMode === "existing") {
        effectiveProxyId = existingProxyConfigId || undefined;
      } else if (jumpMode === "manual") {
        const proxyId = await createSshConfig({
          host: jumpHost.trim(),
          port: parseInt(jumpPort, 10) || 22,
          username: jumpUsername.trim(),
          authMethod: jumpAuthMethod,
          keyPath: jumpAuthMethod === "key" ? jumpKeyPath.trim() : undefined,
          password: jumpAuthMethod === "password" ? jumpPassword : undefined,
        });
        effectiveProxyId = proxyId;
        setTestedProxyConfigId(proxyId);
      }

      // First create a temporary SSH config to test
      const configId = await createSshConfig({
        label: label.trim() || undefined,
        tags: tags.trim() || undefined,
        host: host.trim(),
        port: parseInt(port, 10) || 22,
        username: username.trim(),
        authMethod,
        keyPath: authMethod === "key" ? keyPath.trim() : undefined,
        password: authMethod === "password" ? password : undefined,
        defaultPath: defaultPath.trim() || undefined,
        defaultDockerContainer: defaultDockerContainer.trim() || undefined,
        proxyConfigId: effectiveProxyId,
      });

      // Test the connection
      const testRes = await fetch(`/api/ssh-configs/${configId}/test`, {
        method: "POST",
      });
      const testJson = (await testRes.json()) as {
        ok: boolean;
        error?: string;
      };
      setTestResult(testJson);
      setTestedConfigId(testJson.ok ? configId : null);

      // Clean up test config if test failed
      if (!testJson.ok) {
        await fetch(`/api/ssh-configs/${configId}`, { method: "DELETE" });
        if (jumpMode === "manual" && effectiveProxyId) {
          await fetch(`/api/ssh-configs/${effectiveProxyId}`, { method: "DELETE" });
          setTestedProxyConfigId(null);
        }
      }
    } catch (err) {
      setTestResult({
        ok: false,
        error: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const canSubmitCommon =
      host.trim() &&
      username.trim() &&
      (!isVaultMode || label.trim()) &&
      testedConfigId &&
      testResult?.ok &&
      (isVaultMode || (name.trim() && remotePath.trim()));
    if (!canSubmitCommon) return;

    setLoading(true);
    setError(null);

    try {
      const resolvedProxyConfigId =
        jumpMode === "existing"
          ? existingProxyConfigId || null
          : jumpMode === "manual"
            ? testedProxyConfigId ?? null
            : null;
      const profilePayload: CreateSshConfigRequest = {
        label: label.trim() || undefined,
        tags: tags.trim() || undefined,
        host: host.trim(),
        port: parseInt(port, 10) || 22,
        username: username.trim(),
        authMethod,
        keyPath: authMethod === "key" ? keyPath.trim() : undefined,
        password: authMethod === "password" && password ? password : undefined,
        defaultPath: defaultPath.trim() || undefined,
        defaultDockerContainer: defaultDockerContainer.trim() || undefined,
        proxyConfigId: resolvedProxyConfigId,
      };
      const configIdToSave = isVaultMode && editingProfileId
        ? editingProfileId
        : testedConfigId;
      const profileRes = await fetch(`/api/ssh-configs/${configIdToSave}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload),
      });
      const profileJson = (await profileRes.json()) as
        | ApiResponse<SshConfigInfo>
        | ApiError;
      if ("error" in profileJson) {
        setError(profileJson.error);
        return;
      }

      if (isVaultMode) {
        if (editingProfileId && testedConfigId !== editingProfileId) {
          await fetch(`/api/ssh-configs/${testedConfigId}`, { method: "DELETE" });
        }
        keepTestedConfigRef.current = true;
        onSaved?.(profileJson.data.id);
      } else {
        if (!onCreated) {
          setError("onCreated callback is required in project mode");
          return;
        }
        // Create project with SSH type
        const projectRes = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            type: "SSH",
            color,
            path: remotePath.trim(),
            sshConfigId: testedConfigId,
            dockerContainer: target === "docker" ? dockerContainer.trim() : undefined,
          }),
        });
        const projectJson = (await projectRes.json()) as
          | ApiResponse<ProjectInfo>
          | ApiError;

        if ("error" in projectJson) {
          setError(projectJson.error);
          return;
        }

        keepTestedConfigRef.current = true;
        onCreated(projectJson.data);
      }

      // Reset form
      setName("");
      setProfileId("");
      setLabel("");
      setTags("");
      setColor("#f59e0b");
      setHost("");
      setPort("22");
      setUsername("");
      setKeyPath("~/.ssh/id_rsa");
      setPassword("");
      setJumpMode("none");
      setExistingProxyConfigId("");
      setJumpHost("");
      setJumpPort("22");
      setJumpUsername("");
      setJumpAuthMethod("key");
      setJumpKeyPath("~/.ssh/id_rsa");
      setJumpPassword("");
      setTarget("host");
      setDockerContainer("");
      setDefaultPath("");
      setDefaultDockerContainer("");
      setDockerContainers([]);
      setRemotePath("");
      setTestedConfigId(null);
      setTestedProxyConfigId(null);
      setTestResult(null);
      setShowRemotePicker(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isVaultMode
            ? "Failed to save SSH host"
            : "Failed to create SSH project",
      );
    } finally {
      setLoading(false);
    }
  }

  const sshTestPassed = testResult?.ok && testedConfigId;

  const inputClass =
    "rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 placeholder-neutral-600 focus:border-neutral-500 focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-2 p-3">
      {!isVaultMode && (
        <input
          type="text"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`w-full ${inputClass}`}
        />
      )}
      <div className="grid grid-cols-2 gap-1">
        <input
          type="text"
          placeholder={
            isVaultMode ? "Server name (e.g. prod-bastion)" : "Host alias (e.g. prod-bastion)"
          }
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className={`w-full ${inputClass}`}
        />
        <input
          type="text"
          placeholder="Tags (comma-separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className={`w-full ${inputClass}`}
        />
      </div>
      {!isVaultMode && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Color</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-7 w-9 cursor-pointer rounded border border-neutral-700 bg-neutral-900 p-0.5"
          />
          <code className="text-xs text-neutral-500">{color}</code>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-medium text-neutral-300">Server IP</label>
        <div className="flex gap-1">
          <input
            type="text"
            placeholder="192.168.0.10"
            value={host}
            onChange={(e) => {
              setHost(e.target.value);
              invalidateTest();
            }}
            className={`flex-1 min-w-0 ${inputClass}`}
          />
          <input
            type="text"
            placeholder="Port"
            value={port}
            onChange={(e) => {
              setPort(e.target.value);
              invalidateTest();
            }}
            className={`w-20 shrink-0 ${inputClass}`}
          />
        </div>
      </div>

      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => {
          setUsername(e.target.value);
          invalidateTest();
        }}
        className={`w-full ${inputClass}`}
      />

      <div className="flex gap-2">
        <label className="flex items-center gap-1 text-xs text-neutral-400">
          <input
            type="radio"
            name="authMethod"
            value="key"
            checked={authMethod === "key"}
            onChange={() => {
              setAuthMethod("key");
              invalidateTest();
            }}
            className="accent-neutral-500"
          />
          Key
        </label>
        <label className="flex items-center gap-1 text-xs text-neutral-400">
          <input
            type="radio"
            name="authMethod"
            value="password"
            checked={authMethod === "password"}
            onChange={() => {
              setAuthMethod("password");
              invalidateTest();
            }}
            className="accent-neutral-500"
          />
          Password
        </label>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-neutral-400">Jump Server (Optional)</label>
        <select
          value={jumpMode}
          onChange={(e) => {
            setJumpMode(e.target.value as JumpMode);
            invalidateTest();
          }}
          className={`w-full ${inputClass}`}
        >
          <option value="none">Direct connection</option>
          <option value="existing">Use registered server</option>
          <option value="manual">Enter server manually</option>
        </select>
      </div>

      {jumpMode === "existing" && (
        <select
          value={existingProxyConfigId}
          onChange={(e) => {
            setExistingProxyConfigId(e.target.value);
            invalidateTest();
          }}
          className={`w-full ${inputClass}`}
        >
          <option value="">Select jump server</option>
          {sshConfigs.map((cfg) => (
            <option key={cfg.id} value={cfg.id}>
              {cfg.username}@{cfg.host}:{cfg.port}
            </option>
          ))}
        </select>
      )}

      {jumpMode === "manual" && (
        <div className="space-y-2 rounded border border-neutral-800 p-2">
          <div className="text-xs text-neutral-500">Jump server details</div>
          <div className="flex gap-1">
            <input
              type="text"
              placeholder="Jump host (B)"
              value={jumpHost}
              onChange={(e) => {
                setJumpHost(e.target.value);
                invalidateTest();
              }}
              className={`flex-1 min-w-0 ${inputClass}`}
            />
            <input
              type="text"
              placeholder="Port"
              value={jumpPort}
              onChange={(e) => {
                setJumpPort(e.target.value);
                invalidateTest();
              }}
              className={`w-20 shrink-0 ${inputClass}`}
            />
          </div>
          <input
            type="text"
            placeholder="Jump username"
            value={jumpUsername}
            onChange={(e) => {
              setJumpUsername(e.target.value);
              invalidateTest();
            }}
            className={`w-full ${inputClass}`}
          />
          <div className="flex gap-2">
            <label className="flex items-center gap-1 text-xs text-neutral-400">
              <input
                type="radio"
                name="jumpAuthMethod"
                value="key"
                checked={jumpAuthMethod === "key"}
                onChange={() => {
                  setJumpAuthMethod("key");
                  invalidateTest();
                }}
                className="accent-neutral-500"
              />
              Key
            </label>
            <label className="flex items-center gap-1 text-xs text-neutral-400">
              <input
                type="radio"
                name="jumpAuthMethod"
                value="password"
                checked={jumpAuthMethod === "password"}
                onChange={() => {
                  setJumpAuthMethod("password");
                  invalidateTest();
                }}
                className="accent-neutral-500"
              />
              Password
            </label>
          </div>
          {jumpAuthMethod === "key" && (
            <input
              type="text"
              placeholder="~/.ssh/id_rsa"
              value={jumpKeyPath}
              onChange={(e) => {
                setJumpKeyPath(e.target.value);
                invalidateTest();
              }}
              className={`w-full ${inputClass}`}
            />
          )}
          {jumpAuthMethod === "password" && (
            <input
              type="password"
              placeholder="Jump SSH password"
              value={jumpPassword}
              onChange={(e) => {
                setJumpPassword(e.target.value);
                invalidateTest();
              }}
              className={`w-full ${inputClass}`}
            />
          )}
        </div>
      )}

      {authMethod === "key" && (
        <input
          type="text"
          placeholder="~/.ssh/id_rsa"
          value={keyPath}
          onChange={(e) => {
            setKeyPath(e.target.value);
            invalidateTest();
          }}
          className={`w-full ${inputClass}`}
        />
      )}

      {authMethod === "password" && (
        <input
          type="password"
          placeholder="SSH Password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            invalidateTest();
          }}
          className={`w-full ${inputClass}`}
        />
      )}

      {/* Test Connection button */}
      <button
        type="button"
        onClick={handleTestConnection}
        disabled={
          testing ||
          !host.trim() ||
          !username.trim() ||
          (authMethod === "password" && !password) ||
          (jumpMode === "existing" && !existingProxyConfigId) ||
          (jumpMode === "manual" &&
            (!jumpHost.trim() ||
              !jumpUsername.trim() ||
              (jumpAuthMethod === "password" && !jumpPassword)))
        }
        className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-50"
      >
        {testing ? "Testing..." : "Test Connection"}
      </button>

      {/* Test result */}
      {testResult && (
        <p
          className={`text-xs ${testResult.ok ? "text-green-400" : "text-red-400"}`}
        >
          {testResult.ok
            ? "Connection successful"
            : `Failed: ${testResult.error}`}
        </p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* ── Post-test: Target selector + path + submit ── */}
      {sshTestPassed && (
        <>
          {/* Target Selector (segmented control) */}
          <div className="space-y-1 pt-1">
            <label className="text-xs font-medium text-neutral-300">
              Target
            </label>
            <div className="flex rounded-lg border border-neutral-700 bg-neutral-900 p-0.5">
              <button
                type="button"
                onClick={() => setTarget("host")}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  target === "host"
                    ? "bg-neutral-700 text-neutral-100"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                SSH Host
              </button>
              <button
                type="button"
                onClick={() => setTarget("docker")}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  target === "docker"
                    ? "bg-neutral-700 text-neutral-100"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                Docker Container
              </button>
            </div>
          </div>

          {/* Docker container selection */}
          {target === "docker" && (
            <div className="space-y-2 rounded border border-neutral-800 p-2">
              {loadingDockerContainers ? (
                <div className="flex items-center gap-2 py-3 text-xs text-neutral-500">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-600 border-t-neutral-300" />
                  Loading containers...
                </div>
              ) : dockerContainers.length > 0 ? (
                <div className="space-y-1">
                  {dockerContainers.map((c) => {
                    const isRunning = c.status.toLowerCase().startsWith("up");
                    const isSelected = dockerContainer === c.name;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          setDockerContainer(isSelected ? "" : c.name)
                        }
                        className={`w-full rounded border px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? "border-blue-500/60 bg-blue-500/10"
                            : "border-neutral-700 bg-neutral-900 hover:border-neutral-600 hover:bg-neutral-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs ${isRunning ? "text-green-400" : "text-neutral-600"}`}
                          >
                            {isRunning ? "\u25CF" : "\u25CB"}
                          </span>
                          <span className="text-sm font-medium text-neutral-200">
                            {c.name}
                          </span>
                        </div>
                        <div className="mt-0.5 pl-5 text-xs text-neutral-500">
                          {c.id.slice(0, 12)}{" "}
                          <span className="text-neutral-600">&middot;</span>{" "}
                          {c.status}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="py-2 text-xs text-neutral-500">
                  No containers found on this host.
                </p>
              )}

              {/* Refresh button */}
              {!loadingDockerContainers && (
                <button
                  type="button"
                  onClick={loadRemoteDockerContainers}
                  className="text-xs text-neutral-500 transition-colors hover:text-neutral-300"
                >
                  Refresh list
                </button>
              )}

              {/* Manual input */}
              <input
                type="text"
                placeholder="Or enter container name / ID manually"
                value={dockerContainer}
                onChange={(e) => setDockerContainer(e.target.value)}
                className={`w-full ${inputClass}`}
              />

              {/* Default container for host profile */}
              <input
                type="text"
                placeholder="Default container for this host profile (optional)"
                value={defaultDockerContainer}
                onChange={(e) => setDefaultDockerContainer(e.target.value)}
                className={`w-full ${inputClass}`}
              />
            </div>
          )}

          {!isVaultMode && (
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="/remote/path/to/project"
                value={remotePath}
                onChange={(e) => setRemotePath(e.target.value)}
                className={`flex-1 min-w-0 ${inputClass}`}
                disabled={target === "docker" && !dockerContainer.trim()}
              />
              <button
                type="button"
                onClick={() => setShowRemotePicker((v) => !v)}
                disabled={target === "docker" && !dockerContainer.trim()}
                className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-50"
              >
                Browse
              </button>
            </div>
          )}
          <input
            type="text"
            placeholder="Default path for this host profile (optional)"
            value={defaultPath}
            onChange={(e) => setDefaultPath(e.target.value)}
            className={`w-full ${inputClass}`}
          />

          {!isVaultMode && showRemotePicker && testedConfigId && (
            <RemoteDirectoryPicker
              sshConfigId={testedConfigId}
              dockerContainer={
                target === "docker" ? dockerContainer.trim() : undefined
              }
              onSelect={(path) => {
                setRemotePath(path);
                setShowRemotePicker(false);
              }}
              onClose={() => setShowRemotePicker(false)}
            />
          )}

          {!isVaultMode && (
            <button
              type="submit"
              disabled={
                loading ||
                !name.trim() ||
                !remotePath.trim() ||
                (target === "docker" && !dockerContainer.trim())
              }
              className="w-full rounded bg-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-neutral-600 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Add SSH Project"}
            </button>
          )}
        </>
      )}

      {isVaultMode && !sshTestPassed && (
        <p className="text-xs text-neutral-500">
          Run Test Connection first, then save.
        </p>
      )}

      {isVaultMode && (
        <button
          type="submit"
          disabled={
            loading ||
            !label.trim() ||
            !sshTestPassed ||
            (target === "docker" && !dockerContainer.trim())
          }
          className="w-full rounded bg-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-neutral-600 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save SSH Host"}
        </button>
      )}
    </form>
  );
}
