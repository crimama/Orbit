"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AgentTaskInfo,
  AgentTaskStatus,
  ApiError,
  ApiResponse,
} from "@/lib/types";

interface TaskBoardProps {
  projectId: string;
}

type BoardColumnStatus = "pending" | "in_progress" | "done";

const BOARD_COLUMNS: Array<{
  key: BoardColumnStatus;
  label: string;
}> = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

function getColumnStatus(status: AgentTaskStatus): BoardColumnStatus {
  if (status === "done") return "done";
  if (status === "in_progress") return "in_progress";
  return "pending";
}

function getPriorityMeta(priority: number) {
  if (priority >= 2) {
    return {
      label: "High",
      className: "border-red-500/30 bg-red-500/10 text-red-200",
    };
  }

  if (priority >= 1) {
    return {
      label: "Medium",
      className: "border-orange-500/30 bg-orange-500/10 text-orange-200",
    };
  }

  return {
    label: "Low",
    className: "border-neutral-700 bg-neutral-800 text-neutral-300",
  };
}

function truncateDescription(value: string | null, maxLength = 120) {
  if (!value) return null;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function ArrowButton({
  direction,
  label,
  disabled,
  onClick,
}: {
  direction: "left" | "right";
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-neutral-800 bg-neutral-900 text-neutral-300 transition hover:bg-neutral-800 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {direction === "left" ? (
          <path d="M10.5 3.5 5.5 8l5 4.5" />
        ) : (
          <path d="M5.5 3.5 10.5 8l-5 4.5" />
        )}
      </svg>
    </button>
  );
}

export default function TaskBoard({ projectId }: TaskBoardProps) {
  const [tasks, setTasks] = useState<AgentTaskInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingTaskIds, setPendingTaskIds] = useState<Record<string, boolean>>(
    {},
  );

  const setTaskPending = useCallback((taskId: string, value: boolean) => {
    setPendingTaskIds((current) => {
      if (value) {
        return { ...current, [taskId]: true };
      }

      const next = { ...current };
      delete next[taskId];
      return next;
    });
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        cache: "no-store",
      });
      const json = (await response.json()) as
        | ApiResponse<AgentTaskInfo[]>
        | ApiError;

      if (!response.ok || !("data" in json)) {
        setTasks([]);
        setError("error" in json ? json.error : "Failed to load tasks");
        return;
      }

      setTasks(json.data);
    } catch {
      setTasks([]);
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  async function handleAddTask() {
    const title = newTitle.trim();

    if (!title || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          priority: 1,
        }),
      });
      const json = (await response.json()) as
        | ApiResponse<AgentTaskInfo>
        | ApiError;

      if (!response.ok || !("data" in json)) {
        setError("error" in json ? json.error : "Failed to add task");
        return;
      }

      setTasks((current) => [...current, json.data]);
      setNewTitle("");
    } catch {
      setError("Failed to add task");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(task: AgentTaskInfo, status: AgentTaskStatus) {
    setTaskPending(task.id, true);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/tasks/${task.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      );
      const json = (await response.json()) as
        | ApiResponse<AgentTaskInfo>
        | ApiError;

      if (!response.ok || !("data" in json)) {
        setError("error" in json ? json.error : "Failed to update task");
        return;
      }

      setTasks((current) =>
        current.map((item) => (item.id === task.id ? json.data : item)),
      );
    } catch {
      setError("Failed to update task");
    } finally {
      setTaskPending(task.id, false);
    }
  }

  async function handleDelete(taskId: string) {
    setTaskPending(taskId, true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const json = (await response.json()) as ApiError;
        setError(json.error || "Failed to delete task");
        return;
      }

      setTasks((current) => current.filter((task) => task.id !== taskId));
    } catch {
      setError("Failed to delete task");
    } finally {
      setTaskPending(taskId, false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4 text-neutral-100 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-neutral-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">Task Board</h2>
          <p className="mt-1 text-xs text-neutral-400">
            Kanban board for project coordination across agents.
          </p>
        </div>

        <div className="flex w-full gap-2 sm:max-w-md">
          <input
            type="text"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleAddTask();
              }
            }}
            placeholder="Add a task"
            className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-500 focus:border-neutral-700"
          />
          <button
            type="button"
            onClick={() => void handleAddTask()}
            disabled={submitting || !newTitle.trim()}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-100 transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Adding..." : "Add"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-6 text-sm text-neutral-400">
          Loading tasks...
        </div>
      ) : null}

      {!loading ? (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {BOARD_COLUMNS.map((column) => {
            const columnTasks = tasks.filter(
              (task) => getColumnStatus(task.status) === column.key,
            );

            return (
              <div
                key={column.key}
                className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3"
              >
                <div className="text-xs font-medium uppercase text-neutral-500">
                  {column.label}
                </div>

                <div className="mt-3 space-y-3">
                  {columnTasks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-neutral-800 px-3 py-6 text-center text-xs text-neutral-600">
                      No tasks
                    </div>
                  ) : null}

                  {columnTasks.map((task) => {
                    const priority = getPriorityMeta(task.priority);
                    const description = truncateDescription(task.description);
                    const isPending = Boolean(pendingTaskIds[task.id]);
                    const canMoveLeft =
                      task.status === "in_progress" || task.status === "done";
                    const canMoveRight =
                      task.status === "pending" ||
                      task.status === "blocked" ||
                      task.status === "in_progress";

                    return (
                      <article
                        key={task.id}
                        className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-medium text-neutral-100">
                              {task.title}
                            </h3>
                            {description ? (
                              <p className="mt-1 text-xs leading-5 text-neutral-400">
                                {description}
                              </p>
                            ) : null}
                          </div>

                          <button
                            type="button"
                            aria-label={`Delete ${task.title}`}
                            title="Delete task"
                            onClick={() => void handleDelete(task.id)}
                            disabled={isPending}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-neutral-800 bg-neutral-900 text-sm text-neutral-400 transition hover:bg-neutral-800 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            X
                          </button>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${priority.className}`}
                          >
                            {priority.label}
                          </span>
                          {task.status === "blocked" ? (
                            <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[11px] font-medium text-yellow-200">
                              Blocked
                            </span>
                          ) : null}
                          <span className="text-[11px] text-neutral-500">
                            {task.assignee ? `@${task.assignee}` : "Unassigned"}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="text-[11px] text-neutral-600">
                            {isPending ? "Updating..." : " "}
                          </div>

                          <div className="flex items-center gap-1">
                            <ArrowButton
                              direction="left"
                              label="Move task left"
                              disabled={!canMoveLeft || isPending}
                              onClick={() =>
                                void handleStatusChange(
                                  task,
                                  task.status === "done" ? "in_progress" : "pending",
                                )
                              }
                            />
                            <ArrowButton
                              direction="right"
                              label="Move task right"
                              disabled={!canMoveRight || isPending}
                              onClick={() =>
                                void handleStatusChange(
                                  task,
                                  task.status === "in_progress" ? "done" : "in_progress",
                                )
                              }
                            />
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
