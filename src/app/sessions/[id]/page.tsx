"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import TerminalPage from "@/components/terminal/TerminalPage";
import type { SessionInfo, ApiResponse } from "@/lib/types";

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sessions/${params.id}`)
      .then((res) => res.json())
      .then((json: ApiResponse<SessionInfo>) => {
        if ("error" in json) {
          setError((json as unknown as { error: string }).error);
        } else {
          setSession(json.data);
        }
      })
      .catch((err) => setError(err.message));
  }, [params.id]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading session...</p>
      </div>
    );
  }

  const workspaceId = searchParams.get("workspaceId");

  return (
    <TerminalPage
      sessionId={session.id}
      initialWorkspaceId={workspaceId}
      projectName={session.projectName}
    />
  );
}
