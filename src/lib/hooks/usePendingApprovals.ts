"use client";

import { useEffect, useState, useCallback } from "react";
import { useSocket } from "@/lib/useSocket";
import type { PendingApproval } from "@/lib/types";

export function usePendingApprovals() {
  const { socket, connected } = useSocket();
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>(
    [],
  );

  useEffect(() => {
    if (!socket || !connected) return;

    function onPending(approval: PendingApproval) {
      setPendingApprovals((prev) => [...prev, approval]);
    }

    function onResolved(approvalId: string) {
      setPendingApprovals((prev) => prev.filter((a) => a.id !== approvalId));
    }

    socket.on("interceptor-pending", onPending);
    socket.on("interceptor-resolved", onResolved);

    return () => {
      socket.off("interceptor-pending", onPending);
      socket.off("interceptor-resolved", onResolved);
    };
  }, [socket, connected]);

  const approve = useCallback(
    (approvalId: string) => {
      if (!socket) return;
      socket.emit("interceptor-approve", approvalId);
    },
    [socket],
  );

  const deny = useCallback(
    (approvalId: string) => {
      if (!socket) return;
      socket.emit("interceptor-deny", approvalId);
    },
    [socket],
  );

  const latestApproval =
    pendingApprovals.length > 0
      ? pendingApprovals[pendingApprovals.length - 1]
      : null;

  return { pendingApprovals, approve, deny, latestApproval };
}
