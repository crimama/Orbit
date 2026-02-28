import { NextResponse } from "next/server";
import {
  getInterceptorMode,
  setInterceptorMode,
} from "@/server/pty/interceptorRules";
import { commandInterceptor } from "@/server/pty/interceptor";
import type { InterceptorMode } from "@/lib/types";

const VALID_MODES: InterceptorMode[] = ["blacklist", "allowlist", "hybrid"];

export async function GET() {
  const mode = await getInterceptorMode();
  return NextResponse.json({ data: { mode } });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const mode = body.mode as string | undefined;

  if (!mode || !VALID_MODES.includes(mode as InterceptorMode)) {
    return NextResponse.json(
      { error: `mode must be one of: ${VALID_MODES.join(", ")}` },
      { status: 400 },
    );
  }

  await setInterceptorMode(mode as InterceptorMode);
  commandInterceptor.invalidateCache();
  return NextResponse.json({ data: { mode } });
}
