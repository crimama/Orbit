import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionManager } from "@/server/session/sessionManager";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const body = await request.json();

  if (!("name" in body)) {
    return NextResponse.json(
      { error: "name field is required" },
      { status: 400 },
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() || null : null;

  try {
    await prisma.agentSession.update({
      where: { id: params.id },
      data: { name: name },
    });
  } catch {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const session = await sessionManager.getSession(params.id);
  return NextResponse.json({ data: session });
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await sessionManager.getSession(params.id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ data: session });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  await sessionManager.terminateSession(params.id);
  return NextResponse.json({ data: { terminated: true } });
}
