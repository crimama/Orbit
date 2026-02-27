import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import type { DockerContainerInfo } from "@/lib/types";

const execFileAsync = promisify(execFile);

export async function GET() {
  try {
    const { stdout } = await execFileAsync("docker", [
      "ps",
      "--format",
      "{{.ID}}\t{{.Names}}\t{{.Status}}",
    ]);

    const data: DockerContainerInfo[] = stdout
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
            : "Failed to list docker containers",
      },
      { status: 400 },
    );
  }
}

