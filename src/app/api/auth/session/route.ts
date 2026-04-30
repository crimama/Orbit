import { NextResponse } from "next/server";
import {
  getConfiguredAccessToken,
  writePersistedAccessToken,
} from "@/server/auth/accessTokenStore";
import { safeTokenCompare } from "@/lib/auth";

const tokenCookieName = "orbit_token";

// --- Rate limiting (in-memory) ---
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = { maxAttempts: 5, windowMs: 60_000 };

function getRateLimitKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (entry && now < entry.resetAt) {
    const newCount = entry.count + 1;
    loginAttempts.set(key, { count: newCount, resetAt: entry.resetAt });
    return newCount > RATE_LIMIT.maxAttempts;
  }
  loginAttempts.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
  return 1 > RATE_LIMIT.maxAttempts;
}

// Periodic cleanup of expired rate-limit entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  loginAttempts.forEach((entry, key) => {
    if (now >= entry.resetAt) loginAttempts.delete(key);
  });
}, 5 * 60_000).unref();

function isLoopbackRequest(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "";
  const normalized = ip.replace(/^::ffff:/, "");
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "";
}

function isDesktopLocalRequest(request: Request): boolean {
  if (process.env.ORBIT_DESKTOP_LOCAL !== "1") return false;
  const hostname = new URL(request.url).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return isLoopbackRequest(request) && ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

function setSessionCookie(response: NextResponse, value: string, request: Request) {
  response.cookies.set(tokenCookieName, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !isDesktopLocalRequest(request),
    path: "/",
  });
}

export async function GET() {
  const accessToken = await getConfiguredAccessToken();
  return NextResponse.json({ configured: Boolean(accessToken) });
}

export async function POST(request: Request) {
  // Rate limiting
  const clientIp = getRateLimitKey(request);
  if (isRateLimited(clientIp)) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429 },
    );
  }

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
    // Token initialization is only allowed from loopback IPs
    if (!isLoopbackRequest(request)) {
      return NextResponse.json(
        { error: "Token initialization is only allowed from localhost" },
        { status: 403 },
      );
    }

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
    setSessionCookie(response, token, request);
    return response;
  }

  if (!token || !safeTokenCompare(token, accessToken)) {
    return NextResponse.json(
      { error: "Invalid access token" },
      { status: 401 },
    );
  }

  process.env.ORBIT_ACCESS_TOKEN = accessToken;

  const response = NextResponse.json({ ok: true, configured: true });
  setSessionCookie(response, accessToken, request);
  return response;
}
