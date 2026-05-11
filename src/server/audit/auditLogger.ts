import { prisma } from "@/lib/prisma";
import type { AuditEventType } from "@/lib/types";

class AuditLogger {
  async log(params: {
    eventType: AuditEventType;
    action: string;
    sessionId?: string;
    projectId?: string;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          eventType: params.eventType,
          action: params.action,
          sessionId: params.sessionId ?? null,
          projectId: params.projectId ?? null,
          detail: params.detail ? JSON.stringify(params.detail) : null,
        },
      });
    } catch (error) {
      console.error("[AuditLogger] failed to persist audit event:", error);
    }
  }
}

export const auditLogger = new AuditLogger();
