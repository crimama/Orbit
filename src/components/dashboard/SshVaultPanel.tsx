"use client";

import { useCallback, useEffect, useState } from "react";
import type { SshConfigInfo, SessionInfo, ApiResponse, ApiError } from "@/lib/types";

interface SshVaultPanelProps {
  onQuickConnect: (session: SessionInfo) => void;
  onNewProject: (profileId: string) => void;
  onEditProfile: (profileId: string) => void;
  onAddProfile: () => void;
}

export default function SshVaultPanel({
  onQuickConnect,
  onNewProject,
  onEditProfile,
  onAddProfile,
}: SshVaultPanelProps) {
  const [profiles, setProfiles] = useState<SshConfigInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ssh-configs", { cache: "no-store" });
      const json = (await response.json()) as ApiResponse<SshConfigInfo[]> | ApiError;

      if (!response.ok || !("data" in json)) {
        setProfiles([]);
        setError("error" in json ? json.error : "Failed to load SSH profiles");
        return;
      }

      setProfiles(json.data);
    } catch {
      setProfiles([]);
      setError("Failed to load SSH profiles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  async function handleConnect(profileId: string) {
    setConnectingId(profileId);
    setError(null);

    try {
      const response = await fetch(`/api/ssh-configs/${profileId}/connect`, {
        method: "POST",
      });
      const json = (await response.json()) as ApiResponse<SessionInfo> | ApiError;

      if (!response.ok || !("data" in json)) {
        setError("error" in json ? json.error : "Failed to connect SSH profile");
        return;
      }

      onQuickConnect(json.data);
    } catch {
      setError("Failed to connect SSH profile");
    } finally {
      setConnectingId(null);
    }
  }

  async function handleDelete(profileId: string) {
    if (!window.confirm("Delete this SSH profile?")) return;

    setDeletingId(profileId);
    setError(null);

    try {
      const response = await fetch(`/api/ssh-configs/${profileId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const json = (await response.json()) as ApiError;
        setError(json.error || "Failed to delete SSH profile");
        return;
      }

      await loadProfiles();
    } catch {
      setError("Failed to delete SSH profile");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4 text-neutral-100 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">SSH Vault</h2>
          <p className="mt-1 text-xs text-neutral-400">
            Reuse saved SSH profiles for fast connections and project setup.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddProfile}
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-100 transition hover:bg-neutral-700"
        >
          + Add SSH Profile
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-6 text-sm text-neutral-400">
          Loading SSH profiles...
        </div>
      ) : null}

      {!loading && profiles.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950/50 px-4 py-8 text-center">
          <div className="text-sm text-neutral-300">No SSH profiles saved yet.</div>
          <div className="mt-1 text-xs text-neutral-500">
            Add a profile to enable quick connect and SSH-based project creation.
          </div>
        </div>
      ) : null}

      {!loading && profiles.length > 0 ? (
        <div className="mt-4 space-y-2">
          {profiles.map((config) => {
            const title = config.label || config.host;
            const subtitle = `${config.username}@${config.host}:${config.port}`;
            const tags = config.tags
              ?.split(",")
              .map((tag) => tag.trim())
              .filter(Boolean) ?? [];
            const isConnecting = connectingId === config.id;
            const isDeleting = deletingId === config.id;

            return (
              <div
                key={config.id}
                className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4 transition hover:bg-neutral-800/70"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-neutral-100">
                      {title}
                    </div>
                    <div className="mt-1 truncate text-xs text-neutral-400">
                      {subtitle}
                    </div>
                    {tags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {tags.map((tag) => (
                          <span
                            key={`${config.id}-${tag}`}
                            className="rounded-full border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => void handleConnect(config.id)}
                      disabled={isConnecting}
                      className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-100 transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isConnecting ? "Connecting..." : "Connect"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onNewProject(config.id)}
                      className="rounded-lg border border-neutral-800 px-3 py-2 text-xs text-neutral-300 transition hover:bg-neutral-800 hover:text-neutral-100"
                    >
                      + Project
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditProfile(config.id)}
                      className="rounded-lg border border-neutral-800 px-3 py-2 text-xs text-neutral-300 transition hover:bg-neutral-800 hover:text-neutral-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(config.id)}
                      disabled={isDeleting}
                      className="rounded-lg border border-neutral-800 px-3 py-2 text-xs text-neutral-400 transition hover:bg-neutral-800 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
