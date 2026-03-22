import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseIsoDate(value: string | null, field: string): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid ISO date`);
  }

  return parsed;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId")?.trim() || undefined;

  let from: Date | null;
  let to: Date | null;

  try {
    from = parseIsoDate(searchParams.get("from"), "from");
    to = parseIsoDate(searchParams.get("to"), "to");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid date" },
      { status: 400 },
    );
  }

  if (from && to && from > to) {
    return NextResponse.json(
      { error: "from must be earlier than or equal to to" },
      { status: 400 },
    );
  }

  const sessions = await prisma.agentSession.findMany({
    where: projectId ? { projectId } : undefined,
    select: {
      id: true,
      name: true,
      projectId: true,
      project: {
        select: {
          name: true,
        },
      },
    },
  });

  if (projectId && sessions.length === 0) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
  }

  if (sessions.length === 0) {
    return NextResponse.json({
      data: {
        projectId: projectId ?? null,
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
        totalCost: 0,
        sessions: [],
      },
    });
  }

  const grouped = await prisma.sessionTokenLog.groupBy({
    by: ["sessionId"],
    where: {
      sessionId: { in: sessions.map((session) => session.id) },
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    _sum: {
      estimatedCost: true,
      inputTokens: true,
      outputTokens: true,
    },
  });

  const sessionMap = new Map(sessions.map((session) => [session.id, session]));
  const sessionTotals = grouped.map((entry) => {
    const session = sessionMap.get(entry.sessionId);

    return {
      sessionId: entry.sessionId,
      sessionName: session?.name ?? null,
      projectId: session?.projectId ?? null,
      projectName: session?.project.name ?? null,
      totalCost: entry._sum.estimatedCost ?? 0,
      totalInputTokens: entry._sum.inputTokens ?? 0,
      totalOutputTokens: entry._sum.outputTokens ?? 0,
      totalTokens: (entry._sum.inputTokens ?? 0) + (entry._sum.outputTokens ?? 0),
    };
  });

  return NextResponse.json({
    data: {
      projectId: projectId ?? null,
      from: from?.toISOString() ?? null,
      to: to?.toISOString() ?? null,
      totalCost: sessionTotals.reduce((sum, entry) => sum + entry.totalCost, 0),
      sessions: sessionTotals,
    },
  });
}
