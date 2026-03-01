import { NextResponse } from "next/server";
import {
  getConfiguredAccessToken,
  writePersistedAccessToken,
} from "@/server/auth/accessTokenStore";

const tokenCookieName = "orbit_token";

function setSessionCookie(response: NextResponse, value: string) {
  response.cookies.set(tokenCookieName, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function GET() {
  const accessToken = await getConfiguredAccessToken();
  return NextResponse.json({ configured: Boolean(accessToken) });
}

export async function POST(request: Request) {
  const accessToken = await getConfiguredAccessToken();

  let body: {
    token?: string;
    password?: string;
    confirmToken?: string;
    confirmPassword?: string;
  } = {};
  try {
    body = (await request.json()) as {
      token?: string;
      password?: string;
      confirmToken?: string;
      confirmPassword?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = body.token?.trim() || body.password?.trim() || "";

  if (!accessToken) {
    const confirm =
      body.confirmToken?.trim() || body.confirmPassword?.trim() || "";
    if (!token) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 },
      );
    }
    if (token.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }
    if (!confirm) {
      return NextResponse.json(
        { error: "Password confirmation is required" },
        { status: 400 },
      );
    }
    if (confirm !== token) {
      return NextResponse.json(
        { error: "Password confirmation does not match" },
        { status: 400 },
      );
    }

    await writePersistedAccessToken(token);
    process.env.ORBIT_ACCESS_TOKEN = token;

    const response = NextResponse.json({
      ok: true,
      configured: true,
      initialized: true,
    });
    setSessionCookie(response, token);
    return response;
  }

  if (!token || token !== accessToken) {
    return NextResponse.json(
      { error: "Invalid access token" },
      { status: 401 },
    );
  }

  process.env.ORBIT_ACCESS_TOKEN = accessToken;

  const response = NextResponse.json({ ok: true, configured: true });
  setSessionCookie(response, accessToken);
  return response;
}
