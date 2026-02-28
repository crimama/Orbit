import { NextResponse } from "next/server";

const tokenCookieName = "orbit_token";

export async function POST(request: Request) {
  const accessToken = process.env.ORBIT_ACCESS_TOKEN?.trim() ?? "";
  if (!accessToken) {
    return NextResponse.json(
      { error: "ORBIT_ACCESS_TOKEN is not configured on server" },
      { status: 400 },
    );
  }

  let body: { token?: string } = {};
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = body.token?.trim() ?? "";
  if (!token || token !== accessToken) {
    return NextResponse.json({ error: "Invalid access token" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(tokenCookieName, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}

