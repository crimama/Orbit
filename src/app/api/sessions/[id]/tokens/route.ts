import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SessionTokenInfo } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await prisma.agentSession.findUnique({
    where: { id: params.id },
    select: { id: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const [aggregate, latestModel, logs] = await Promise.all([
    prisma.sessionTokenLog.aggregate({
      where: { sessionId: params.id },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        estimatedCost: true,
      },
    }),
    prisma.sessionTokenLog.findFirst({
      where: { sessionId: params.id, model: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { model: true },
    }),
    prisma.sessionTokenLog.findMany({
      where: { sessionId: params.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        inputTokens: true,
        outputTokens: true,
        estimatedCost: true,
        model: true,
        createdAt: true,
      },
    }),
  ]);

  const summary: SessionTokenInfo & { totalTokens: number } = {
    sessionId: params.id,
    totalInputTokens: aggregate._sum.inputTokens ?? 0,
    totalOutputTokens: aggregate._sum.outputTokens ?? 0,
    totalCost: aggregate._sum.estimatedCost ?? 0,
    totalTokens:
      (aggregate._sum.inputTokens ?? 0) + (aggregate._sum.outputTokens ?? 0),
    ...(latestModel?.model ? { model: latestModel.model } : {}),
  };

  return NextResponse.json({
    data: {
      summary,
      logs: logs.map((log) => ({
        ...log,
        createdAt: log.createdAt.toISOString(),
      })),
    },
  });
}
