import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { graphManager } from "@/server/graph/graphManager";
import type { UpdateSkillRequest, CreateSkillEdgeRequest } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const skill = await prisma.skill.findUnique({
      where: { id: params.id },
      include: { edgesFrom: true, edgesTo: true },
    });

    if (!skill) {
      return NextResponse.json(
        { error: "Skill not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: skill });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch skill" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const body = (await request.json()) as
    | UpdateSkillRequest
    | { edge: CreateSkillEdgeRequest };

  // Handle edge creation via PUT with { edge: ... }
  if ("edge" in body) {
    try {
      const edge = await graphManager.createEdge(body.edge);
      return NextResponse.json({ data: edge }, { status: 201 });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
          return NextResponse.json(
            { error: "Edge already exists between these skills" },
            { status: 409 },
          );
        }
      }
      return NextResponse.json(
        { error: "Failed to create edge" },
        { status: 500 },
      );
    }
  }

  try {
    const skill = await graphManager.updateSkill(params.id, body);
    return NextResponse.json({ data: skill });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return NextResponse.json(
          { error: "Skill not found" },
          { status: 404 },
        );
      }
    }
    return NextResponse.json(
      { error: "Failed to update skill" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { searchParams } = new URL(request.url);
  const edgeId = searchParams.get("edgeId");

  // If edgeId is provided, delete the edge instead
  if (edgeId) {
    try {
      await graphManager.deleteEdge(edgeId);
      return NextResponse.json({ data: { deleted: true } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2025") {
          return NextResponse.json(
            { error: "Edge not found" },
            { status: 404 },
          );
        }
      }
      return NextResponse.json(
        { error: "Failed to delete edge" },
        { status: 500 },
      );
    }
  }

  try {
    await graphManager.deleteSkill(params.id);
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return NextResponse.json(
          { error: "Skill not found" },
          { status: 404 },
        );
      }
    }
    return NextResponse.json(
      { error: "Failed to delete skill" },
      { status: 500 },
    );
  }
}
