"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import TerminalPage from "@/components/terminal/TerminalPage";
import type { SessionInfo, ApiResponse, ApiError } from "@/lib/types";

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = params?.id;
    if (!id) return;
    fetch(`/api/sessions/${id}`)
      .then((res) => res.json())
      .then((json: ApiResponse<SessionInfo> | ApiError) => {
        if ("error" in json) {
          setError(json.error);
        } else {
          setSession(json.data);
        }
      })
      .catch((err) => setError(err.message));
  }, [params?.id]);

  if (error) {
    return (
      <div className="bg-orbit-bg-primary flex h-[100dvh] items-center justify-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="bg-orbit-bg-primary flex h-[100dvh] items-center justify-center">
        <p className="text-orbit-text-muted">Loading session...</p>
      </div>
    );
  }

  const workspaceId = searchParams?.get("workspaceId") ?? null;

  return (
    <TerminalPage
      sessionId={session.id}
      initialWorkspaceId={workspaceId}
      projectName={session.projectName}
    />
  );
}
