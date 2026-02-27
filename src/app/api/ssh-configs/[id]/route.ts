import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SshConfigInfo, CreateSshConfigRequest } from "@/lib/types";
import {
  encryptSshPassword,
  isEncryptedSshPassword,
} from "@/server/ssh/credentials";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const config = await prisma.sshConfig.findUnique({
    where: { id: params.id },
  });

  if (!config) {
    return NextResponse.json(
      { error: "SSH config not found" },
      { status: 404 },
    );
  }

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

  return NextResponse.json({ data });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const body = (await request.json()) as Partial<CreateSshConfigRequest>;

  try {
    const existing = await prisma.sshConfig.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "SSH config not found" },
        { status: 404 },
      );
    }

    const nextAuthMethod = body.authMethod ?? existing.authMethod;
    if (!["key", "password"].includes(nextAuthMethod)) {
      return NextResponse.json(
        { error: 'authMethod must be "key" or "password"' },
        { status: 400 },
      );
    }

    const nextKeyPath = body.keyPath !== undefined ? body.keyPath : existing.keyPath;
    const nextPasswordRaw =
      body.password !== undefined ? body.password : existing.password;

    if (nextAuthMethod === "key" && !nextKeyPath) {
      return NextResponse.json(
        { error: "keyPath is required for key-based auth" },
        { status: 400 },
      );
    }
    if (nextAuthMethod === "password" && !nextPasswordRaw) {
      return NextResponse.json(
        { error: "password is required for password auth" },
        { status: 400 },
      );
    }

    let passwordForStore: string | null = null;
    if (nextAuthMethod === "password") {
      try {
        if (body.password !== undefined) {
          passwordForStore = encryptSshPassword(body.password);
        } else if (nextPasswordRaw && !isEncryptedSshPassword(nextPasswordRaw)) {
          // Opportunistically migrate legacy plain-text value.
          passwordForStore = encryptSshPassword(nextPasswordRaw);
        } else {
          passwordForStore = nextPasswordRaw ?? null;
        }
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

    const config = await prisma.sshConfig.update({
      where: { id: params.id },
      data: {
        ...(body.host !== undefined && { host: body.host }),
        ...(body.port !== undefined && { port: body.port }),
        ...(body.username !== undefined && { username: body.username }),
        ...(body.label !== undefined && { label: body.label?.trim() || null }),
        ...(body.tags !== undefined && { tags: body.tags?.trim() || null }),
        authMethod: nextAuthMethod,
        keyPath: nextAuthMethod === "key" ? nextKeyPath : null,
        password: nextAuthMethod === "password" ? passwordForStore : null,
        ...(body.defaultPath !== undefined && {
          defaultPath: body.defaultPath?.trim() || null,
        }),
        ...(body.defaultDockerContainer !== undefined && {
          defaultDockerContainer: body.defaultDockerContainer?.trim() || null,
        }),
        ...(body.proxyConfigId !== undefined && { proxyConfigId: body.proxyConfigId }),
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

    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return NextResponse.json(
          { error: "SSH config not found" },
          { status: 404 },
        );
      }
    }
    return NextResponse.json(
      { error: "Failed to update SSH config" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await prisma.sshConfig.delete({ where: { id: params.id } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return NextResponse.json(
          { error: "SSH config not found" },
          { status: 404 },
        );
      }
      if (err.code === "P2003") {
        return NextResponse.json(
          { error: "Cannot delete SSH config with linked projects" },
          { status: 409 },
        );
      }
    }
    return NextResponse.json(
      { error: "Failed to delete SSH config" },
      { status: 500 },
    );
  }
}
