import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SshConfigInfo, CreateSshConfigRequest } from "@/lib/types";
import { encryptSshPassword } from "@/server/ssh/credentials";

export async function GET() {
  const configs = await prisma.sshConfig.findMany({
    orderBy: { createdAt: "desc" },
  });

  const data: SshConfigInfo[] = configs.map((c) => ({
    id: c.id,
    label: c.label,
    tags: c.tags,
    host: c.host,
    port: c.port,
    username: c.username,
    authMethod: c.authMethod as SshConfigInfo["authMethod"],
    keyPath: c.keyPath,
    defaultPath: c.defaultPath,
    defaultDockerContainer: c.defaultDockerContainer,
    proxyConfigId: c.proxyConfigId,
    createdAt: c.createdAt.toISOString(),
  }));

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateSshConfigRequest;

  if (!body.host || !body.username) {
    return NextResponse.json(
      { error: "host and username are required" },
      { status: 400 },
    );
  }

  if (!body.authMethod || !["key", "password"].includes(body.authMethod)) {
    return NextResponse.json(
      { error: 'authMethod must be "key" or "password"' },
      { status: 400 },
    );
  }

  if (body.authMethod === "key" && !body.keyPath) {
    return NextResponse.json(
      { error: "keyPath is required for key-based auth" },
      { status: 400 },
    );
  }

  if (body.authMethod === "password" && !body.password) {
    return NextResponse.json(
      { error: "password is required for password auth" },
      { status: 400 },
    );
  }

  let passwordForStore: string | null = null;
  if (body.authMethod === "password") {
    try {
      passwordForStore = encryptSshPassword(body.password!);
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Failed to secure SSH password",
        },
        { status: 400 },
      );
    }
  }

  const config = await prisma.sshConfig.create({
    data: {
      label: body.label?.trim() || null,
      tags: body.tags?.trim() || null,
      host: body.host,
      port: body.port ?? 22,
      username: body.username,
      authMethod: body.authMethod,
      keyPath: body.authMethod === "key" ? body.keyPath ?? null : null,
      password: passwordForStore,
      defaultPath: body.defaultPath?.trim() || null,
      defaultDockerContainer: body.defaultDockerContainer?.trim() || null,
      proxyConfigId: body.proxyConfigId ?? null,
    },
  });

  const data: SshConfigInfo = {
    id: config.id,
    label: config.label,
    tags: config.tags,
    host: config.host,
    port: config.port,
    username: config.username,
    authMethod: config.authMethod as SshConfigInfo["authMethod"],
    keyPath: config.keyPath,
    defaultPath: config.defaultPath,
    defaultDockerContainer: config.defaultDockerContainer,
    proxyConfigId: config.proxyConfigId,
    createdAt: config.createdAt.toISOString(),
  };

  return NextResponse.json({ data }, { status: 201 });
}
