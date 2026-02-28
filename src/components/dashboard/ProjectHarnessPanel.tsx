"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ProjectHarnessConfigInfo,
  ProjectHarnessProvider,
  UpsertProjectHarnessRequest,
} from "@/lib/types";

interface ProjectHarnessPanelProps {
  projectId: string;
}

const OH_MY_OPENCODE_PRESET = JSON.stringify(
  {
    version: 1,
    categories: {
      quick: { model: "openai/gpt-5-nano" },
      "visual-engineering": { model: "google/gemini-3-pro" },
      ultrabrain: { model: "openai/gpt-5.3-codex" },
    },
    agents: {
      sisyphus: {
        temperature: 0.3,
        permission: { edit: "ask", bash: "ask", webfetch: "allow" },
      },
      oracle: {
        permission: { edit: "deny", bash: "ask" },
      },
      explore: {
        permission: { edit: "deny", bash: "deny" },
      },
    },
    disabled_hooks: [],
    experimental: {
      aggressive_truncation: false,
    },
  },
  null,
  2,
);

type PermissionValue = "allow" | "ask" | "deny";
type GuidedMode = "guided" | "json";

interface OhMyOpenCodeGuidedState {
  aggressiveTruncation: boolean;
  sisyphusTemperature: number;
  sisyphusEdit: PermissionValue;
  sisyphusBash: PermissionValue;
  sisyphusWebfetch: PermissionValue;
  oracleEdit: PermissionValue;
  oracleBash: PermissionValue;
  exploreEdit: PermissionValue;
  exploreBash: PermissionValue;
}

interface HarnessElement {
  id: string;
  label: string;
  description: string;
  recommended?: boolean;
}

const PROVIDERS: ProjectHarnessProvider[] = [
  "oh-my-opencode",
  "claude-code",
  "codex",
  "terminal",
];

const PERMISSION_OPTIONS: PermissionValue[] = ["allow", "ask", "deny"];
const HARNESS_ELEMENTS: HarnessElement[] = [
  {
    id: "architecture-guardrail",
    label: "Architecture Guardrail",
    description: "명령/툴 사용 경계를 강제해 위험한 실행을 줄입니다.",
    recommended: true,
  },
  {
    id: "context-engineering",
    label: "Context Engineering",
    description: "세션 컨텍스트를 구조화해 재시작/협업 품질을 높입니다.",
    recommended: true,
  },
  {
    id: "observability",
    label: "Observability",
    description: "에이전트 이벤트/메트릭을 수집해 상태를 추적합니다.",
    recommended: true,
  },
  {
    id: "golden-path",
    label: "Golden Path",
    description: "안전한 작업 경로를 기본 흐름으로 고정합니다.",
    recommended: true,
  },
  {
    id: "gc-agent",
    label: "GC Agent",
    description: "유휴 세션/프로세스를 자동 정리해 리소스를 보호합니다.",
  },
  {
    id: "session-fork",
    label: "Session Fork",
    description: "탐색/실험을 별도 분기로 분리해 회귀를 줄입니다.",
  },
];

function initialDraft(): UpsertProjectHarnessRequest {
  return {
    enabled: true,
    provider: "oh-my-opencode",
    profileName: "oh-my-opencode default",
    autoApproveSafe: false,
    maxParallel: 3,
    config: OH_MY_OPENCODE_PRESET,
  };
}

function initialGuidedState(): OhMyOpenCodeGuidedState {
  return {
    aggressiveTruncation: false,
    sisyphusTemperature: 0.3,
    sisyphusEdit: "ask",
    sisyphusBash: "ask",
    sisyphusWebfetch: "allow",
    oracleEdit: "deny",
    oracleBash: "ask",
    exploreEdit: "deny",
    exploreBash: "deny",
  };
}

function safeStringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function normalizeElementIds(value: string[]): string[] {
  const allowed = new Set(HARNESS_ELEMENTS.map((el) => el.id));
  return Array.from(
    new Set(value.filter((id) => typeof id === "string" && allowed.has(id))),
  ).sort();
}

function normalizeElements(value: string[]): string {
  return normalizeElementIds(value).join("|");
}

function normalizeDraft(draft: UpsertProjectHarnessRequest): string {
  return JSON.stringify({
    enabled: draft.enabled ?? true,
    provider: draft.provider ?? "oh-my-opencode",
    profileName: (draft.profileName ?? "").trim(),
    autoApproveSafe: draft.autoApproveSafe ?? false,
    maxParallel: draft.maxParallel ?? 3,
    config: (draft.config ?? "").trim(),
  });
}

function parseConfig(value: string | undefined): { ok: true; value: unknown } | { ok: false } {
  if (!value || !value.trim()) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false };
  }
}

function extractHarnessElements(configText: string | undefined): string[] {
  const parsed = parseConfig(configText);
  if (!parsed.ok || typeof parsed.value !== "object" || parsed.value === null) {
    return [];
  }
  const root = parsed.value as Record<string, unknown>;
  const orbit = (root.__orbitHarness ?? {}) as Record<string, unknown>;
  const list = orbit.appliedElements;
  if (!Array.isArray(list)) return [];
  return normalizeElementIds(list.filter((v): v is string => typeof v === "string"));
}

function injectHarnessElements(
  configText: string | undefined,
  elements: string[],
): string | null {
  const parsed = parseConfig(configText);
  if (!parsed.ok || typeof parsed.value !== "object" || parsed.value === null) {
    return null;
  }
  const root = parsed.value as Record<string, unknown>;
  const nextRoot = { ...root };
  const normalized = normalizeElementIds(elements);
  nextRoot.__orbitHarness = {
    appliedElements: normalized,
  };
  return safeStringify(nextRoot);
}

function parseGuidedState(configText: string | undefined): OhMyOpenCodeGuidedState | null {
  const parsed = parseConfig(configText);
  if (!parsed.ok || typeof parsed.value !== "object" || parsed.value === null) return null;
  const root = parsed.value as Record<string, unknown>;
  const agents = (root.agents ?? {}) as Record<string, Record<string, unknown>>;
  const sisyphus = agents.sisyphus ?? {};
  const oracle = agents.oracle ?? {};
  const explore = agents.explore ?? {};
  const experimental = (root.experimental ?? {}) as Record<string, unknown>;

  const safePermission = (value: unknown, fallback: PermissionValue): PermissionValue =>
    value === "allow" || value === "ask" || value === "deny" ? value : fallback;

  const sPerm = (sisyphus.permission ?? {}) as Record<string, unknown>;
  const oPerm = (oracle.permission ?? {}) as Record<string, unknown>;
  const ePerm = (explore.permission ?? {}) as Record<string, unknown>;

  return {
    aggressiveTruncation: experimental.aggressive_truncation === true,
    sisyphusTemperature:
      typeof sisyphus.temperature === "number" ? sisyphus.temperature : 0.3,
    sisyphusEdit: safePermission(sPerm.edit, "ask"),
    sisyphusBash: safePermission(sPerm.bash, "ask"),
    sisyphusWebfetch: safePermission(sPerm.webfetch, "allow"),
    oracleEdit: safePermission(oPerm.edit, "deny"),
    oracleBash: safePermission(oPerm.bash, "ask"),
    exploreEdit: safePermission(ePerm.edit, "deny"),
    exploreBash: safePermission(ePerm.bash, "deny"),
  };
}

function guidedStateToConfig(state: OhMyOpenCodeGuidedState): string {
  return safeStringify({
    version: 1,
    categories: {
      quick: { model: "openai/gpt-5-nano" },
      "visual-engineering": { model: "google/gemini-3-pro" },
      ultrabrain: { model: "openai/gpt-5.3-codex" },
    },
    agents: {
      sisyphus: {
        temperature: Number(state.sisyphusTemperature.toFixed(2)),
        permission: {
          edit: state.sisyphusEdit,
          bash: state.sisyphusBash,
          webfetch: state.sisyphusWebfetch,
        },
      },
      oracle: {
        permission: { edit: state.oracleEdit, bash: state.oracleBash },
      },
      explore: {
        permission: { edit: state.exploreEdit, bash: state.exploreBash },
      },
    },
    disabled_hooks: [],
    experimental: {
      aggressive_truncation: state.aggressiveTruncation,
    },
  });
}

export default function ProjectHarnessPanel({
  projectId,
}: ProjectHarnessPanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);
  const [draft, setDraft] = useState<UpsertProjectHarnessRequest>(initialDraft);
  const [syncedDraft, setSyncedDraft] =
    useState<UpsertProjectHarnessRequest>(initialDraft);
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [syncedElements, setSyncedElements] = useState<string[]>([]);
  const [mode, setMode] = useState<GuidedMode>("guided");
  const [guided, setGuided] = useState<OhMyOpenCodeGuidedState>(initialGuidedState);

  const provider = draft.provider ?? "oh-my-opencode";
  const isOpencode = provider === "oh-my-opencode";
  const configValidation = useMemo(() => parseConfig(draft.config), [draft.config]);
  const configError = configValidation.ok ? null : "Config JSON is invalid";
  const hasChanged = useMemo(
    () =>
      normalizeDraft(draft) !== normalizeDraft(syncedDraft) ||
      normalizeElements(selectedElements) !== normalizeElements(syncedElements),
    [draft, selectedElements, syncedDraft, syncedElements],
  );

  const syncFromServer = useCallback(
    (data: ProjectHarnessConfigInfo | null) => {
      if (!data) {
        setConfigId(null);
        const next = initialDraft();
        setDraft(next);
        setSyncedDraft(next);
        setSelectedElements([]);
        setSyncedElements([]);
        setGuided(initialGuidedState());
        setMode("guided");
        return;
      }
      setConfigId(data.id);
      const nextDraft = {
        enabled: data.enabled,
        provider: data.provider,
        profileName: data.profileName,
        autoApproveSafe: data.autoApproveSafe,
        maxParallel: data.maxParallel,
        config: data.config,
      };
      setDraft(nextDraft);
      setSyncedDraft(nextDraft);
      const extracted = extractHarnessElements(data.config);
      setSelectedElements(extracted);
      setSyncedElements(extracted);
      const parsedGuided = parseGuidedState(data.config);
      if (data.provider === "oh-my-opencode" && parsedGuided) {
        setGuided(parsedGuided);
        setMode("guided");
      } else {
        setMode("json");
      }
    },
    [],
  );

  const fetchHarness = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/harness`);
      const json = (await res.json()) as {
        data: ProjectHarnessConfigInfo | null;
      };
      syncFromServer(json.data ?? null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load harness config",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, syncFromServer]);

  useEffect(() => {
    void fetchHarness();
  }, [fetchHarness]);

  async function handleSave() {
    if (configError) {
      setError(configError);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const configWithElements = injectHarnessElements(
        draft.config ?? "{}",
        selectedElements,
      );
      if (!configWithElements) {
        throw new Error("Config JSON is invalid");
      }

      const res = await fetch(`/api/projects/${projectId}/harness`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, config: configWithElements }),
      });
      const json = (await res.json()) as
        | { data: ProjectHarnessConfigInfo }
        | { error: string };
      if (!res.ok || !("data" in json)) {
        throw new Error(
          "error" in json ? json.error : "Failed to save harness config",
        );
      }
      syncFromServer(json.data);
      setSuccess(
        configId ? "Harness profile updated" : "Harness profile created",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save harness config",
      );
    } finally {
      setSaving(false);
    }
  }

  function applyOhMyOpenCodePreset() {
    const nextGuided = initialGuidedState();
    setGuided(nextGuided);
    setMode("guided");
    setDraft((prev) => ({
      ...prev,
      provider: "oh-my-opencode",
      profileName: prev.profileName?.trim()
        ? prev.profileName
        : "oh-my-opencode default",
      maxParallel: 3,
      autoApproveSafe: false,
      config:
        injectHarnessElements(guidedStateToConfig(nextGuided), selectedElements) ??
        guidedStateToConfig(nextGuided),
    }));
  }

  function resetToSynced() {
    setDraft(syncedDraft);
    setSelectedElements(syncedElements);
    const parsedGuided = parseGuidedState(syncedDraft.config);
    if ((syncedDraft.provider ?? "oh-my-opencode") === "oh-my-opencode" && parsedGuided) {
      setGuided(parsedGuided);
      setMode("guided");
    } else {
      setMode("json");
    }
    setError(null);
    setSuccess(null);
  }

  function updateGuided(next: Partial<OhMyOpenCodeGuidedState>) {
    setGuided((prev) => {
      const merged = { ...prev, ...next };
      setDraft((old) => ({
        ...old,
        config:
          injectHarnessElements(guidedStateToConfig(merged), selectedElements) ??
          guidedStateToConfig(merged),
      }));
      return merged;
    });
  }

  return (
    <section className="rounded-2xl border border-neutral-700/60 bg-neutral-900/50 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
          Project Harness
        </h3>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={applyOhMyOpenCodePreset}
            className="rounded-full border border-cyan-700/50 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/20"
          >
            Preset
          </button>
          <button
            type="button"
            onClick={() => void fetchHarness()}
            className="rounded-full border border-neutral-700 px-2.5 py-1 text-[11px] font-medium text-neutral-300 hover:bg-neutral-800"
          >
            Reload
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-neutral-500">Loading harness profile...</p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                Provider
              </span>
              <select
                value={draft.provider ?? "oh-my-opencode"}
                onChange={(e) =>
                  setDraft((prev) => {
                    const nextProvider = e.target.value as ProjectHarnessProvider;
                    const next = { ...prev, provider: nextProvider };
                    if (nextProvider === "oh-my-opencode") {
                      const parsedGuided = parseGuidedState(prev.config);
                      const nextGuided = parsedGuided ?? initialGuidedState();
                      setGuided(nextGuided);
                      setMode("guided");
                      next.config =
                        injectHarnessElements(
                          guidedStateToConfig(nextGuided),
                          selectedElements,
                        ) ?? guidedStateToConfig(nextGuided);
                    } else {
                      setMode("json");
                    }
                    return next;
                  })
                }
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-200"
              >
                {PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                Profile Name
              </span>
              <input
                type="text"
                value={draft.profileName ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, profileName: e.target.value }))
                }
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-200"
                placeholder="team-default"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-300">
              <input
                type="checkbox"
                checked={draft.enabled ?? true}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, enabled: e.target.checked }))
                }
              />
              Enabled
            </label>

            <label className="flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-300">
              <input
                type="checkbox"
                checked={draft.autoApproveSafe ?? false}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    autoApproveSafe: e.target.checked,
                  }))
                }
              />
              Auto-approve safe
            </label>

            <label className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-300">
              <span className="mb-1 block text-[11px] uppercase tracking-wide text-neutral-500">
                  Max Parallel
                </span>
                <input
                type="number"
                min={1}
                max={10}
                value={draft.maxParallel ?? 3}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    maxParallel: Number(e.target.value || 3),
                  }))
                }
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
                />
            </label>
          </div>

          <div className="space-y-2 rounded-lg border border-neutral-700 bg-neutral-950 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                Harness Engineering Elements
              </span>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedElements(
                      HARNESS_ELEMENTS.filter((el) => el.recommended).map((el) => el.id),
                    )
                  }
                  className="rounded border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800"
                >
                  Recommended
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedElements(HARNESS_ELEMENTS.map((el) => el.id))}
                  className="rounded border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedElements([])}
                  className="rounded border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {HARNESS_ELEMENTS.map((element) => {
                const checked = selectedElements.includes(element.id);
                return (
                  <div
                    key={element.id}
                    className={`rounded-lg border px-2 py-1.5 text-xs ${
                      checked
                        ? "border-cyan-700/60 bg-cyan-500/10 text-cyan-100"
                        : "border-neutral-700 bg-neutral-900 text-neutral-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            checked
                              ? "bg-cyan-500/20 text-cyan-200"
                              : "bg-neutral-800 text-neutral-500"
                          }`}
                        >
                          {checked ? "ON" : "OFF"}
                        </span>
                        <span className="font-medium">{element.label}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedElements((prev) =>
                            checked
                              ? prev.filter((id) => id !== element.id)
                              : normalizeElementIds([...prev, element.id]),
                          )
                        }
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          checked
                            ? "bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30"
                            : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                        }`}
                      >
                        {checked ? "Disable" : "Enable"}
                      </button>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      {element.recommended ? (
                        <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-cyan-200">
                          Rec
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-400">
                      {element.description}
                    </p>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-neutral-500">
              Applied: {selectedElements.length} / {HARNESS_ELEMENTS.length}
            </p>
          </div>

          {isOpencode ? (
            <div className="space-y-2 rounded-lg border border-neutral-700 bg-neutral-950 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                  OpenCode Config Mode
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setMode("guided")}
                    className={`rounded px-2 py-1 text-[11px] ${
                      mode === "guided"
                        ? "bg-neutral-700 text-neutral-100"
                        : "text-neutral-400 hover:bg-neutral-800"
                    }`}
                  >
                    Guided
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("json")}
                    className={`rounded px-2 py-1 text-[11px] ${
                      mode === "json"
                        ? "bg-neutral-700 text-neutral-100"
                        : "text-neutral-400 hover:bg-neutral-800"
                    }`}
                  >
                    JSON
                  </button>
                </div>
              </div>

              {mode === "guided" ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-300">
                      <span className="mb-1 block text-[11px] uppercase tracking-wide text-neutral-500">
                        Sisyphus Temperature
                      </span>
                      <input
                        type="number"
                        step={0.1}
                        min={0}
                        max={1}
                        value={guided.sisyphusTemperature}
                        onChange={(e) =>
                          updateGuided({
                            sisyphusTemperature: Math.min(
                              1,
                              Math.max(0, Number(e.target.value || 0.3)),
                            ),
                          })
                        }
                        className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-200"
                      />
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-300">
                      <input
                        type="checkbox"
                        checked={guided.aggressiveTruncation}
                        onChange={(e) =>
                          updateGuided({ aggressiveTruncation: e.target.checked })
                        }
                      />
                      Aggressive truncation
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {[
                      ["Sisyphus Edit", "sisyphusEdit"],
                      ["Sisyphus Bash", "sisyphusBash"],
                      ["Sisyphus Webfetch", "sisyphusWebfetch"],
                      ["Oracle Edit", "oracleEdit"],
                      ["Oracle Bash", "oracleBash"],
                      ["Explore Edit", "exploreEdit"],
                      ["Explore Bash", "exploreBash"],
                    ].map(([label, key]) => (
                      <label
                        key={key}
                        className="space-y-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5"
                      >
                        <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                          {label}
                        </span>
                        <select
                          value={guided[key as keyof OhMyOpenCodeGuidedState] as string}
                          onChange={(e) =>
                            updateGuided({
                              [key]: e.target.value as PermissionValue,
                            } as Partial<OhMyOpenCodeGuidedState>)
                          }
                          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-200"
                        >
                          {PERMISSION_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {mode === "json" ? (
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                    Provider Config (JSON)
                  </span>
                  <textarea
                    value={draft.config ?? "{}"}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, config: e.target.value }))
                    }
                    rows={10}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-xs text-neutral-200"
                    placeholder={`{\n  "agents": {}\n}`}
                  />
                </label>
              ) : null}
            </div>
          ) : (
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                Provider Config (JSON)
              </span>
              <textarea
                value={draft.config ?? "{}"}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, config: e.target.value }))
                }
                rows={10}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-xs text-neutral-200"
                placeholder={`{\n  "config": {}\n}`}
              />
            </label>
          )}

          {configError && <p className="text-xs text-amber-400">{configError}</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}
          {success && <p className="text-xs text-emerald-400">{success}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={resetToSynced}
              disabled={saving || !hasChanged}
              className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:bg-neutral-800 disabled:opacity-60"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasChanged || !!configError}
              className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-900 transition hover:bg-white disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : configId
                  ? "Save Harness"
                  : "Create Harness"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
