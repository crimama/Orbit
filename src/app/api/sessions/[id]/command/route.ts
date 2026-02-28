import { NextResponse } from "next/server";
import { sessionManager } from "@/server/session/sessionManager";

interface SendCommandRequest {
  input?: string;
  appendNewline?: boolean;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const body = (await request.json()) as SendCommandRequest;
  const input = typeof body.input === "string" ? body.input : "";

  if (!input.trim()) {
    return NextResponse.json({ error: "input is required" }, { status: 400 });
  }

  const payload = body.appendNewline === false ? input : `${input}\r`;

  try {
    await sessionManager.sendInput(params.id, payload);
    return NextResponse.json({ data: { sent: true } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send command";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
