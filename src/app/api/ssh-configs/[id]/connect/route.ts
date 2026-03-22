import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionManager } from "@/server/session/sessionManager";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      cols?: number;
      rows?: number;
    };

    const config = await prisma.sshConfig.findUnique({
      where: { id: params.id },
    });

    if (!config) {
      return NextResponse.json(
        { error: "SSH config not found" },
        { status: 404 },
      );
    }

    let project = await prisma.project.findFirst({
      where: { sshConfigId: params.id, adhoc: true },
    });

    if (!project) {
      project = await prisma.project.create({
        data: {
          name: config.label || config.host,
          type: "SSH",
          path: config.defaultPath || "~",
          sshConfigId: params.id,
          adhoc: true,
          color: "#f59e0b",
        },
      });
    }

    const session = await sessionManager.createSession({
      projectId: project.id,
      agentType: "terminal",
      cols: body.cols,
      rows: body.rows,
    });

    return NextResponse.json({ data: session });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to quick connect";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
