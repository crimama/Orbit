import { gzipSync } from "zlib";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPtyBackend } from "@/server/pty/ptyBackend";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const checkpoints = await prisma.sessionCheckpoint.findMany({
    where: { sessionId: params.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      sessionId: true,
      name: true,
      cwd: true,
      metadata: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    data: checkpoints.map((checkpoint) => ({
      ...checkpoint,
      createdAt: checkpoint.createdAt.toISOString(),
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const body = (await request.json()) as { name?: string };
  const backend = getPtyBackend(params.id);
  const scrollback = backend?.getScrollback(params.id);
  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : "checkpoint";

  try {
    const checkpoint = await prisma.sessionCheckpoint.create({
      data: {
        sessionId: params.id,
        name,
        cwd: null,
        scrollback: scrollback ? gzipSync(Buffer.from(scrollback)) : null,
      },
      select: {
        id: true,
        sessionId: true,
        name: true,
        cwd: true,
        metadata: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        data: {
          ...checkpoint,
          createdAt: checkpoint.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create checkpoint";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
