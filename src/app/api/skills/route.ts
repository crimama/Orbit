import { NextResponse } from "next/server";
import { graphManager } from "@/server/graph/graphManager";
import type { CreateSkillRequest } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId query parameter is required" },
      { status: 400 },
    );
  }

  const state = await graphManager.getGraphState(projectId);
  return NextResponse.json({ data: state });
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateSkillRequest;

  if (!body.projectId || !body.name) {
    return NextResponse.json(
      { error: "projectId and name are required" },
      { status: 400 },
    );
  }

  const skill = await graphManager.createSkill(body);
  return NextResponse.json({ data: skill }, { status: 201 });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    positions: { id: string; posX: number; posY: number }[];
  };

  if (!body.positions || !Array.isArray(body.positions)) {
    return NextResponse.json(
      { error: "positions array is required" },
      { status: 400 },
    );
  }

  await graphManager.updatePositions(body.positions);
  return NextResponse.json({ data: { updated: true } });
}
