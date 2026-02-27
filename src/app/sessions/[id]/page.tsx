"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import TerminalPage from "@/components/terminal/TerminalPage";
import type { SessionInfo, ApiResponse } from "@/lib/types";

export default function SessionPage() {
  const params = useParams<{ id: string }>();
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
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <p className="text-neutral-500">Loading session...</p>
      </div>
    );
  }

  return (
    <TerminalPage
      sessionId={session.id}
      projectName={session.projectName}
    />
  );
}
