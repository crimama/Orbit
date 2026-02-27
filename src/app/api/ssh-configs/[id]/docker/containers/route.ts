import { NextResponse } from "next/server";
import { sshManager } from "@/server/ssh/sshManager";
import type { DockerContainerInfo } from "@/lib/types";

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const status = sshManager.getStatus(params.id);
    if (status.state !== "connected") {
      await sshManager.connect(params.id);
    }

    const format = "{{.ID}}\t{{.Names}}\t{{.Status}}";
    const output = await sshManager.exec(
      params.id,
      `docker ps --format ${shellQuote(format)}`,
    );

    const data: DockerContainerInfo[] = output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [id = "", name = "", status = ""] = line.split("\t");
        return { id, name, status };
      })
      .filter((c) => c.id && c.name);

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to list remote docker containers",
      },
      { status: 400 },
    );
  }
}

