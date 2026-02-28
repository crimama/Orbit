import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const allowRemote = process.env.ORBIT_ALLOW_REMOTE === "true";
const accessToken = process.env.ORBIT_ACCESS_TOKEN?.trim() ?? "";
const tokenCookieName = "orbit_token";
const remoteScope = process.env.ORBIT_REMOTE_SCOPE?.trim().toLowerCase() ?? "any";

function isLoopbackHostname(value: string): boolean {
  const normalized = value.replace(/^\[|\]$/g, "").toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function isLoopbackIp(value: string | null): boolean {
  if (!value) return false;
  const first = value.split(",")[0]?.trim();
  if (!first) return false;
  const normalized = first.replace(/^::ffff:/, "");
  return normalized === "127.0.0.1" || normalized === "::1";
}

function isTailscaleIp(value: string | null): boolean {
  if (!value) return false;
  const first = value.split(",")[0]?.trim();
  if (!first) return false;
  const normalized = first
    .replace(/^::ffff:/, "")
    .replace(/^\[|\]$/g, "")
    .toLowerCase()
    .split("%")[0];

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalized)) {
    const octets = normalized.split(".").map((part) => Number(part));
    if (octets.length !== 4 || octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return false;
    }
    const n =
      ((octets[0] << 24) >>> 0) +
      ((octets[1] << 16) >>> 0) +
      ((octets[2] << 8) >>> 0) +
      (octets[3] >>> 0);
    const start = ((100 << 24) >>> 0) + ((64 << 16) >>> 0);
    const end = ((100 << 24) >>> 0) + ((127 << 16) >>> 0) + (255 << 8) + 255;
    return n >= start && n <= end;
  }

  return normalized.startsWith("fd7a:115c:a1e0:");
}

function isAllowedRemoteIp(value: string | null): boolean {
  // In some runtimes/dev servers request.ip can be missing.
  // Fallback to token auth in that case instead of hard blocking.
  if (!value || !value.trim()) return true;
  if (isLoopbackIp(value)) return true;
  if (remoteScope === "tailscale") return isTailscaleIp(value);
  return true;
}

function isAuthorizedByToken(request: NextRequest): boolean {
  if (!accessToken) return true;

  const byCookie = request.cookies.get(tokenCookieName)?.value?.trim();
  if (byCookie && byCookie === accessToken) return true;

  const byHeader = request.headers.get("x-orbit-token")?.trim();
  if (byHeader && byHeader === accessToken) return true;

  const auth = request.headers.get("authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const byBearer = auth.slice(7).trim();
    if (byBearer && byBearer === accessToken) return true;
  }

  return false;
}

function unauthorized(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Unauthorized: valid access token required" },
      { status: 401 },
    );
  }
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/login" || pathname.startsWith("/api/auth/session")) {
    return NextResponse.next();
  }

  const tokenFromQuery = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (accessToken && tokenFromQuery && tokenFromQuery === accessToken) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("token");
    const response = NextResponse.redirect(url);
    response.cookies.set(tokenCookieName, accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return response;
  }

  if (allowRemote) {
    const remoteIp =
      request.ip ??
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip");
    if (!isAllowedRemoteIp(remoteIp)) {
      return NextResponse.json(
        { error: "Forbidden: only loopback/Tailscale clients are allowed" },
        { status: 403 },
      );
    }
    return isAuthorizedByToken(request) ? NextResponse.next() : unauthorized(request);
  }

  const hostAllowed = isLoopbackHostname(request.nextUrl.hostname);
  const ipAllowed =
    isLoopbackIp(request.ip ?? null) ||
    isLoopbackIp(request.headers.get("x-forwarded-for"));

  if (hostAllowed || ipAllowed) {
    return isAuthorizedByToken(request) ? NextResponse.next() : unauthorized(request);
  }

  return NextResponse.json(
    { error: "Forbidden: API is restricted to loopback access" },
    { status: 403 },
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)"],
};
