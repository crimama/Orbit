import { NextResponse } from "next/server";
import { sshManager } from "@/server/ssh/sshManager";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await sshManager.connect(params.id);
    // Test successful — disconnect since this is just a test
    sshManager.disconnect(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Connection test failed",
      },
      { status: 200 },
    );
  }
}
