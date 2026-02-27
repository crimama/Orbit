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
  if (severity !== "warn" && severity !== "block") {
    return NextResponse.json(
      { error: "severity must be 'warn' or 'block'" },
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
