import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { CreateInterceptorRuleRequest, InterceptorRuleInfo } from "@/lib/types";

export async function GET() {
  const rules = await prisma.interceptorRule.findMany({
    orderBy: { createdAt: "asc" },
  });

  const data: InterceptorRuleInfo[] = rules.map((r) => ({
    id: r.id,
    pattern: r.pattern,
    description: r.description,
    severity: r.severity as InterceptorRuleInfo["severity"],
    enabled: r.enabled,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateInterceptorRuleRequest;

  if (!body.pattern || !body.description) {
    return NextResponse.json(
      { error: "pattern and description are required" },
      { status: 400 },
    );
  }

  // Validate regex pattern
  try {
    new RegExp(body.pattern);
  } catch {
    return NextResponse.json(
      { error: "Invalid regex pattern" },
      { status: 400 },
    );
  }

  const severity = body.severity ?? "block";
  if (severity !== "warn" && severity !== "block" && severity !== "allow") {
    return NextResponse.json(
      { error: "severity must be 'warn', 'block', or 'allow'" },
      { status: 400 },
    );
  }

  const rule = await prisma.interceptorRule.create({
    data: {
      pattern: body.pattern,
      description: body.description,
      severity,
      enabled: body.enabled ?? true,
    },
  });

  const data: InterceptorRuleInfo = {
    id: rule.id,
    pattern: rule.pattern,
    description: rule.description,
    severity: rule.severity as InterceptorRuleInfo["severity"],
    enabled: rule.enabled,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };

  return NextResponse.json({ data }, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json();

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Validate severity if provided
  if (
    body.severity &&
    body.severity !== "warn" &&
    body.severity !== "block" &&
    body.severity !== "allow"
  ) {
    return NextResponse.json(
      { error: "severity must be 'warn', 'block', or 'allow'" },
      { status: 400 },
    );
  }

  // Validate regex pattern if provided
  if (body.pattern) {
    try {
      new RegExp(body.pattern);
    } catch {
      return NextResponse.json(
        { error: "Invalid regex pattern" },
        { status: 400 },
      );
    }
  }

  const updateData: Record<string, unknown> = {};
  if (body.pattern !== undefined) updateData.pattern = body.pattern;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.severity !== undefined) updateData.severity = body.severity;
  if (body.enabled !== undefined) updateData.enabled = body.enabled;

  try {
    const rule = await prisma.interceptorRule.update({
      where: { id: body.id },
      data: updateData,
    });

    const data: InterceptorRuleInfo = {
      id: rule.id,
      pattern: rule.pattern,
      description: rule.description,
      severity: rule.severity as InterceptorRuleInfo["severity"],
      enabled: rule.enabled,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id query param required" }, { status: 400 });
  }

  try {
    await prisma.interceptorRule.delete({ where: { id } });
    return NextResponse.json({ data: { deleted: true } });
  } catch {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }
}
