import { NextResponse } from "next/server";
import { listLocks } from "@/server/coordination/fileLockManager";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const data = await listLocks(params.id);
  return NextResponse.json({ data });
}
