import { createServer, type IncomingMessage, type ServerResponse } from "http";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { registerSocketHandlers } from "@/server/socket/handler";
import { sessionManager } from "@/server/session/sessionManager";
import { sshManager } from "@/server/ssh/sshManager";
import { getConfiguredAccessTokenSync } from "@/server/auth/accessTokenStore";
import { safeTokenCompare } from "@/lib/auth";
import { SOCKET_PATH, DEFAULT_PORT } from "@/lib/constants";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from "@/lib/types";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
const allowRemote = process.env.ORBIT_ALLOW_REMOTE === "true";
const host = process.env.HOST ?? (allowRemote ? "0.0.0.0" : "127.0.0.1");
const remoteScope =
  process.env.ORBIT_REMOTE_SCOPE?.trim().toLowerCase() ?? "tailscale";
const loopbackVerifiedHeader = "x-orbit-loopback-verified";

if (!(process.env.ORBIT_ACCESS_TOKEN?.trim() ?? "")) {
  const persistedToken = getConfiguredAccessTokenSync();
  if (persistedToken) {
    process.env.ORBIT_ACCESS_TOKEN = persistedToken;
  }
}

function currentAccessToken(): string {
  return process.env.ORBIT_ACCESS_TOKEN?.trim() ?? "";
}

function assertRemoteAuthConfigured(): void {
  if (!allowRemote || currentAccessToken()) return;
  throw new Error(
    "Remote access requires a configured ORBIT_ACCESS_TOKEN or persisted access token before startup.",
  );
}

function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  const normalized = address.replace(/^::ffff:/, "");
  return normalized === "127.0.0.1" || normalized === "::1";
}

function isTailscaleAddress(address: string | undefined): boolean {
  if (!address) return false;
  const normalized = address
    .replace(/^::ffff:/, "")
    .replace(/^\[|\]$/g, "")
    .toLowerCase()
    .split("%")[0];

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalized)) {
    const octets = normalized.split(".").map((part) => Number(part));
    if (
      octets.length !== 4 ||
      octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)
    ) {
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

function isAllowedRemoteAddress(address: string | undefined): boolean {
  if (isLoopbackAddress(address)) return true;
  if (remoteScope === "tailscale") return isTailscaleAddress(address);
  if (remoteScope === "any") return true;
  return false;
}

function isLoopbackHostname(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
}

function extractHostnameFromOrigin(origin: string): string | null {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

function readCookie(
  rawCookie: string | undefined,
  name: string,
): string | null {
  if (!rawCookie) return null;
  const parts = rawCookie.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) {
      return decodeURIComponent(rest.join("=").trim());
    }
  }
  return null;
}

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function hasValidSocketToken(socket: {
  handshake: {
    auth: Record<string, unknown>;
    headers: Record<string, string | string[] | undefined>;
    query: Record<string, string | string[] | undefined>;
  };
}): boolean {
  const accessToken = currentAccessToken();
  if (!accessToken) return false;

  const authTokenRaw = socket.handshake.auth?.token;
  const authToken = typeof authTokenRaw === "string" ? authTokenRaw.trim() : "";
  if (authToken && safeTokenCompare(authToken, accessToken)) return true;

  const headerToken =
    firstValue(socket.handshake.headers["x-orbit-token"])?.trim() ?? "";
  if (headerToken && safeTokenCompare(headerToken, accessToken)) return true;

  const authorization =
    firstValue(socket.handshake.headers.authorization)?.trim() ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    const bearer = authorization.slice(7).trim();
    if (bearer && safeTokenCompare(bearer, accessToken)) return true;
  }

  const cookieToken =
    readCookie(
      firstValue(socket.handshake.headers.cookie) ?? undefined,
      "orbit_token",
    )?.trim() ?? "";
  if (cookieToken && safeTokenCompare(cookieToken, accessToken)) return true;

  // WARNING: Token in query string is visible in logs. Prefer cookie/header auth.
  const queryToken = firstValue(socket.handshake.query.token)?.trim() ?? "";
  if (queryToken && safeTokenCompare(queryToken, accessToken)) return true;

  return false;
}

function hasValidHttpToken(
  request: IncomingMessage,
  accessToken: string,
): boolean {
  if (!accessToken) return false;

  const headerToken =
    firstValue(request.headers["x-orbit-token"])?.trim() ?? "";
  if (headerToken && safeTokenCompare(headerToken, accessToken)) return true;

  const authorization = firstValue(request.headers.authorization)?.trim() ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    const bearer = authorization.slice(7).trim();
    if (bearer && safeTokenCompare(bearer, accessToken)) return true;
  }

  const cookieToken =
    readCookie(
      firstValue(request.headers.cookie) ?? undefined,
      "orbit_token",
    )?.trim() ?? "";
  if (cookieToken && safeTokenCompare(cookieToken, accessToken)) return true;

  return false;
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/api/auth/session")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/manifest.json") return true;
  return false;
}

function writeJson(
  response: ServerResponse,
  status: number,
  data: { error: string },
): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(data));
}

function writeRedirect(response: ServerResponse, location: string): void {
  response.statusCode = 302;
  response.setHeader("location", location);
  response.end();
}

async function main() {
  assertRemoteAuthConfigured();

  const app = next({ dev });
  const handle = app.getRequestHandler();

  await app.prepare();
  await sessionManager.reconcileOnStartup();

  const httpServer = createServer((req, res) => {
    const requestUrl = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "127.0.0.1"}`,
    );
    const pathname = requestUrl.pathname;
    const accessToken = currentAccessToken();

    const remoteAllowed = allowRemote
      ? isAllowedRemoteAddress(req.socket.remoteAddress)
      : isLoopbackAddress(req.socket.remoteAddress);
    if (!remoteAllowed) {
      const message = allowRemote
        ? "Forbidden: only loopback/Tailscale clients are allowed"
        : "Forbidden: API is restricted to loopback access";
      writeJson(res, 403, { error: message });
      return;
    }
    req.headers[loopbackVerifiedHeader] = isLoopbackAddress(
      req.socket.remoteAddress,
    )
      ? "true"
      : "false";

    // WARNING: Token in URL query string is visible in server/proxy logs.
    // Consume it immediately, set a cookie, and redirect to strip it from the URL.
    const tokenFromQuery = requestUrl.searchParams.get("token")?.trim() ?? "";
    if (accessToken && tokenFromQuery && safeTokenCompare(tokenFromQuery, accessToken)) {
      requestUrl.searchParams.delete("token");
      const nextPath = `${requestUrl.pathname}${requestUrl.search}` || "/";
      const cookie =
        `orbit_token=${encodeURIComponent(accessToken)}; Path=/; HttpOnly; SameSite=Lax` +
        `${dev ? "" : "; Secure"}`;
      res.setHeader("set-cookie", cookie);
      writeRedirect(res, nextPath);
      return;
    }

    if (!isPublicPath(pathname) && !hasValidHttpToken(req, accessToken)) {
      if (pathname.startsWith("/api/")) {
        writeJson(res, 401, {
          error: "Unauthorized: valid access token required",
        });
        return;
      }

      const nextTarget = `${pathname}${requestUrl.search}`;
      const loginUrl = `/login?next=${encodeURIComponent(nextTarget)}`;
      writeRedirect(res, loginUrl);
      return;
    }

    handle(req, res);
  });

  const io = new SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    path: SOCKET_PATH,
    cors: {
      origin: (origin, callback) => {
        if (allowRemote) {
          callback(null, true);
          return;
        }
        if (!origin) {
          callback(null, true);
          return;
        }
        const allowed = isLoopbackHostname(extractHostnameFromOrigin(origin));
        callback(
          allowed ? null : new Error("Socket origin is not allowed"),
          allowed,
        );
      },
    },
    allowRequest: (req, callback) => {
      if (allowRemote) {
        const allowed = isAllowedRemoteAddress(req.socket.remoteAddress);
        callback(
          allowed ? null : "Only loopback/Tailscale connections are allowed",
          allowed,
        );
        return;
      }
      const allowed = isLoopbackAddress(req.socket.remoteAddress);
      callback(allowed ? null : "Loopback connections only", allowed);
    },
  });

  io.use((socket, next) => {
    if (hasValidSocketToken(socket)) {
      next();
      return;
    }
    next(new Error("Unauthorized"));
  });

  registerSocketHandlers(io);
  sessionManager.startGC();

  httpServer.listen(port, host, () => {
    console.log(`> Agent Orbit running on http://${host}:${port}`);
    console.log(`> Socket.io path: ${SOCKET_PATH}`);
    console.log(`> Mode: ${dev ? "development" : "production"}`);
    console.log(
      `> Remote access: ${allowRemote ? "enabled" : "disabled (loopback only)"}`,
    );
    if (allowRemote) {
      console.log(`> Remote scope: ${remoteScope}`);
      if (remoteScope === "any") {
        console.warn(
          "> Warning: ORBIT_REMOTE_SCOPE=any allows non-Tailscale remote clients. Keep a strong access token configured.",
        );
      } else if (remoteScope !== "tailscale") {
        console.warn(
          `> Warning: Unknown ORBIT_REMOTE_SCOPE=${remoteScope}; remote clients outside loopback will be rejected.`,
        );
      }
    }
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n> Shutting down...");
    sessionManager.stopGC();
    sshManager.disconnectAll();
    io.close();
    httpServer.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
