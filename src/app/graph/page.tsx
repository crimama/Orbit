"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SkillGraph from "@/components/graph/SkillGraph";
import type { ProjectInfo, ApiResponse } from "@/lib/types";

function GraphPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get("projectId");

  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(!projectId);

  // If no projectId, fetch projects for the selector
  useEffect(() => {
    if (projectId) return;

    let cancelled = false;
    setLoadingProjects(true);

    async function fetchProjects() {
      try {
        const res = await fetch("/api/projects");
        const json = (await res.json()) as ApiResponse<ProjectInfo[]>;
        if (!cancelled && "data" in json) {
          setProjects(json.data);
        }
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    }

    fetchProjects();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleSelectProject = useCallback(
    (id: string) => {
      router.push(`/graph?projectId=${id}`);
    },
    [router],
  );

  // If projectId exists, render the graph
  if (projectId) {
    return (
      <div className="flex h-screen flex-col bg-gray-900">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-800 px-4 py-2">
          <button
            onClick={() => router.push("/")}
            className="rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
          >
            &larr; Dashboard
          </button>
          <div className="h-4 w-px bg-gray-700" />
          <h1 className="text-sm font-semibold text-gray-200">Skill Graph</h1>
          <span className="text-xs text-gray-500">{projectId}</span>
        </div>

        {/* Graph canvas */}
        <div className="flex-1">
          <SkillGraph projectId={projectId} />
        </div>
      </div>
    );
  }

  // No projectId — show project selector
  return (
    <div className="flex h-screen flex-col bg-gray-900">
      <div className="flex items-center gap-3 border-b border-gray-800 px-4 py-2">
        <button
          onClick={() => router.push("/")}
          className="rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
        >
          &larr; Dashboard
        </button>
        <div className="h-4 w-px bg-gray-700" />
        <h1 className="text-sm font-semibold text-gray-200">Skill Graph</h1>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="w-80">
          <h2 className="mb-4 text-center text-sm font-semibold text-gray-300">
            Select a Project
          </h2>
          {loadingProjects ? (
            <div className="text-center text-xs text-gray-500">
              Loading projects...
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center text-xs text-gray-500">
              No projects found. Create one from the Dashboard first.
            </div>
          ) : (
            <div className="space-y-1">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleSelectProject(project.id)}
                  className="w-full rounded-lg border border-gray-700 px-3 py-2 text-left transition-colors hover:border-gray-600 hover:bg-gray-800"
                >
                  <div className="text-sm font-medium text-gray-200">
                    {project.name}
                  </div>
                  <div className="text-xs text-gray-500">{project.path}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GraphPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-gray-900">
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      }
    >
      <GraphPageContent />
    </Suspense>
  );
}
