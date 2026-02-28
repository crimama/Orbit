import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type {
  ReplaceSessionChatMessagesRequest,
  SessionChatMessageInfo,
} from "@/lib/types";

function toInfo(row: {
  id: string;
  sessionId: string;
  role: string;
  text: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}): SessionChatMessageInfo {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role as SessionChatMessageInfo["role"],
    text: row.text,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function validRole(role: string): boolean {
  return role === "user" || role === "assistant";
}

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

  const rows = await prisma.sessionChatMessage.findMany({
    where: { sessionId: params.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ data: rows.map(toInfo) });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await prisma.agentSession.findUnique({
    where: { id: params.id },
    select: { id: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = (await request.json()) as ReplaceSessionChatMessagesRequest;
  const messages = Array.isArray(body.messages) ? body.messages : [];

  for (const msg of messages) {
    if (!validRole(msg.role)) {
      return NextResponse.json(
        { error: 'message role must be "user" or "assistant"' },
        { status: 400 },
      );
    }
    if (typeof msg.text !== "string") {
      return NextResponse.json(
        { error: "message text must be string" },
        { status: 400 },
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.sessionChatMessage.deleteMany({ where: { sessionId: params.id } });
    if (messages.length > 0) {
      await tx.sessionChatMessage.createMany({
        data: messages.map((msg, index) => ({
          sessionId: params.id,
          role: msg.role,
          text: msg.text,
          position: index,
        })),
      });
    }
  });

  const rows = await prisma.sessionChatMessage.findMany({
    where: { sessionId: params.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ data: rows.map(toInfo) });
}
