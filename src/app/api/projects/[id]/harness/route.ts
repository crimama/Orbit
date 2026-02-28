import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type {
  ProjectHarnessConfigInfo,
  UpsertProjectHarnessRequest,
} from "@/lib/types";

function toInfo(row: {
  id: string;
  projectId: string;
  enabled: boolean;
  provider: string;
  profileName: string | null;
  autoApproveSafe: boolean;
  maxParallel: number;
  config: string;
  createdAt: Date;
  updatedAt: Date;
}): ProjectHarnessConfigInfo {
  return {
    id: row.id,
    projectId: row.projectId,
    enabled: row.enabled,
    provider: row.provider as ProjectHarnessConfigInfo["provider"],
    profileName: row.profileName,
    autoApproveSafe: row.autoApproveSafe,
    maxParallel: row.maxParallel,
    config: row.config,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function validateProvider(value: string): boolean {
  return ["oh-my-opencode", "claude-code", "codex", "terminal"].includes(value);
}

const OH_MY_OPENCODE_DEFAULT = JSON.stringify(
  {
    version: 1,
    agents: {
      sisyphus: {
        temperature: 0.3,
        permission: { edit: "ask", bash: "ask" },
      },
      oracle: {
        permission: { edit: "deny", bash: "ask" },
      },
      explore: {
        permission: { edit: "deny", bash: "deny" },
      },
    },
    disabled_hooks: [],
    experimental: {
      aggressive_truncation: false,
    },
  },
  null,
  2,
);

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const row = await prisma.projectHarnessConfig.findUnique({
    where: { projectId: params.id },
  });

  if (!row) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({ data: toInfo(row) });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = (await request.json()) as UpsertProjectHarnessRequest;

  if (body.provider && !validateProvider(body.provider)) {
    return NextResponse.json(
      {
        error:
          'provider must be "oh-my-opencode" | "claude-code" | "codex" | "terminal"',
      },
      { status: 400 },
    );
  }

  if (
    body.maxParallel !== undefined &&
    (!Number.isInteger(body.maxParallel) ||
      body.maxParallel < 1 ||
      body.maxParallel > 10)
  ) {
    return NextResponse.json(
      { error: "maxParallel must be an integer between 1 and 10" },
      { status: 400 },
    );
  }

  if (body.config !== undefined) {
    try {
      JSON.parse(body.config);
    } catch {
      return NextResponse.json(
        { error: "config must be a valid JSON string" },
        { status: 400 },
      );
    }
  }

  const incomingProvider = body.provider;
  const isOhMyOpenCode = incomingProvider === "oh-my-opencode";
  const nextConfig =
    body.config !== undefined
      ? body.config
      : isOhMyOpenCode
        ? OH_MY_OPENCODE_DEFAULT
        : undefined;

  const row = await prisma.projectHarnessConfig.upsert({
    where: { projectId: params.id },
    create: {
      projectId: params.id,
      enabled: body.enabled ?? true,
      provider: body.provider ?? "oh-my-opencode",
      profileName: body.profileName ?? "oh-my-opencode default",
      autoApproveSafe: body.autoApproveSafe ?? false,
      maxParallel: body.maxParallel ?? 3,
      config: nextConfig ?? OH_MY_OPENCODE_DEFAULT,
    },
    update: {
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(body.provider !== undefined ? { provider: body.provider } : {}),
      ...(body.profileName !== undefined
        ? { profileName: body.profileName }
        : {}),
      ...(body.autoApproveSafe !== undefined
        ? { autoApproveSafe: body.autoApproveSafe }
        : {}),
      ...(body.maxParallel !== undefined
        ? { maxParallel: body.maxParallel }
        : {}),
      ...(nextConfig !== undefined ? { config: nextConfig } : {}),
    },
  });

  return NextResponse.json({ data: toInfo(row) });
}
