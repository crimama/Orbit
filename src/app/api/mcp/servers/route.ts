import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  const servers = await prisma.mcpServer.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { createdAt: "desc" },
  });

  const data = servers.map((s) => ({
    id: s.id,
    projectId: s.projectId,
    name: s.name,
    transport: s.transport,
    command: s.command,
    args: s.args,
    url: s.url,
    enabled: s.enabled,
    createdAt: s.createdAt.toISOString(),
  }));

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name: string;
    transport?: string;
    command?: string;
    args?: string[];
    url?: string;
    projectId?: string;
  };

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const server = await prisma.mcpServer.create({
    data: {
      name: body.name,
      transport: body.transport ?? "stdio",
      command: body.command ?? null,
      args: body.args ? JSON.stringify(body.args) : null,
      url: body.url ?? null,
      projectId: body.projectId ?? null,
    },
  });

  return NextResponse.json(
    { data: { ...server, createdAt: server.createdAt.toISOString() } },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  await prisma.mcpServer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
