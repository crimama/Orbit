export type UrlValidationResult =
  | { ok: true; url: URL; normalizedUrl: string }
  | { ok: false; error: string };

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const TOKEN_QUERY_KEYS = new Set(["token", "access_token", "sessionaccesstoken"]);

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return LOOPBACK_HOSTS.has(normalized) || normalized.startsWith("127.");
}

export function validateRemoteOrbitUrl(input: string): UrlValidationResult {
  const value = input.trim();
  if (!value) return { ok: false, error: "URL is required" };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "URL must be absolute" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only http:// and https:// Orbit URLs are supported" };
  }

  if (!url.hostname) return { ok: false, error: "URL host is required" };
  if (url.username || url.password) {
    return { ok: false, error: "Credentials must not be embedded in Orbit URLs" };
  }

  for (const key of Array.from(url.searchParams.keys())) {
    if (TOKEN_QUERY_KEYS.has(key.toLowerCase())) {
      return { ok: false, error: "Access tokens must be entered in the session-only token field, not saved in Orbit URLs" };
    }
  }

  url.hash = "";
  return { ok: true, url, normalizedUrl: url.toString() };
}

export function validateLoopbackHttpUrl(input: string): UrlValidationResult {
  const result = validateRemoteOrbitUrl(input);
  if (!result.ok) return result;
  if (result.url.protocol !== "http:") {
    return { ok: false, error: "Local desktop URLs must use http:// loopback" };
  }
  if (!isLoopbackHostname(result.url.hostname)) {
    return { ok: false, error: "Local desktop URLs must resolve to loopback" };
  }
  return result;
}

export function assertValidPort(port: unknown, label = "port"): number {
  if (!Number.isInteger(port) || typeof port !== "number" || port < 1 || port > 65535) {
    throw new Error(`${label} must be an integer between 1 and 65535`);
  }
  return port;
}

export function assertValidAutoPort(port: unknown, label = "port"): "auto" | number {
  if (port === "auto") return "auto";
  return assertValidPort(port, label);
}
