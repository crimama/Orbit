import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { AuditEventType, AuditLogInfo } from "@/lib/types";

function parseNumber(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return fallback;
  return parsed;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId")?.trim() || undefined;
  const projectId = searchParams.get("projectId")?.trim() || undefined;
  const eventType = searchParams.get("eventType")?.trim() || undefined;
  const limit = Math.min(parseNumber(searchParams.get("limit"), 50), 200);
  const offset = parseNumber(searchParams.get("offset"), 0);

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(sessionId && { sessionId }),
      ...(projectId && { projectId }),
      ...(eventType && { eventType: eventType as AuditEventType }),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  const data: AuditLogInfo[] = logs.map((log) => ({
    id: log.id,
    sessionId: log.sessionId,
    projectId: log.projectId,
    eventType: log.eventType as AuditEventType,
    action: log.action,
    detail: log.detail,
    createdAt: log.createdAt.toISOString(),
  }));

  return NextResponse.json({ data });
}
