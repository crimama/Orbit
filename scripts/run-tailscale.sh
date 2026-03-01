#!/usr/bin/env bash
set -euo pipefail

if ! command -v tailscale >/dev/null 2>&1; then
  echo "tailscale CLI not found. Install Tailscale first."
  exit 1
fi

if ! tailscale status >/dev/null 2>&1; then
  echo "Tailscale is not connected. Run: tailscale up"
  exit 1
fi

token_file="${ORBIT_ACCESS_TOKEN_FILE:-$HOME/.orbit/access-token}"
token_generated=false
token_rotated=false
auto_token_provision="${ORBIT_TAILNET_AUTO_TOKEN:-true}"

generate_token() {
  node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))'
}

ensure_token_dir() {
  local dir
  dir="$(dirname "$token_file")"
  mkdir -p "$dir"
  chmod 700 "$dir" 2>/dev/null || true
}

persist_token() {
  local value="$1"
  ensure_token_dir
  umask 077
  printf '%s' "$value" >"$token_file"
  chmod 600 "$token_file" 2>/dev/null || true
}

load_token_from_file() {
  if [[ -s "$token_file" ]]; then
    tr -d '\r\n' <"$token_file"
  fi
}

rotate="${ORBIT_ACCESS_TOKEN_ROTATE:-false}"
if [[ "$auto_token_provision" == "false" ]]; then
  if [[ -n "${ORBIT_ACCESS_TOKEN:-}" ]]; then
    ORBIT_ACCESS_TOKEN="$(printf '%s' "$ORBIT_ACCESS_TOKEN" | tr -d '\r\n')"
  fi
elif [[ "$rotate" == "true" ]]; then
  new_token="$(generate_token)"
  if [[ -z "$new_token" ]]; then
    echo "Failed to generate ORBIT_ACCESS_TOKEN."
    exit 1
  fi
  persist_token "$new_token"
  ORBIT_ACCESS_TOKEN="$new_token"
  token_generated=true
  token_rotated=true
elif [[ -n "${ORBIT_ACCESS_TOKEN:-}" ]]; then
  ORBIT_ACCESS_TOKEN="$(printf '%s' "$ORBIT_ACCESS_TOKEN" | tr -d '\r\n')"
  if [[ -z "$ORBIT_ACCESS_TOKEN" ]]; then
    echo "ORBIT_ACCESS_TOKEN is empty after trimming."
    exit 1
  fi
elif token_from_file="$(load_token_from_file)" && [[ -n "$token_from_file" ]]; then
  ORBIT_ACCESS_TOKEN="$token_from_file"
else
  new_token="$(generate_token)"
  if [[ -z "$new_token" ]]; then
    echo "Failed to generate ORBIT_ACCESS_TOKEN."
    exit 1
  fi
  persist_token "$new_token"
  ORBIT_ACCESS_TOKEN="$new_token"
  token_generated=true
fi

export ORBIT_ACCESS_TOKEN

if [[ -z "${SSH_PASSWORD_SECRET:-}" ]]; then
  echo "SSH_PASSWORD_SECRET is required when using SSH password auth."
fi

TS_IP="$(tailscale ip -4 | head -n1 || true)"
if [[ -z "${TS_IP}" ]]; then
  echo "Could not detect Tailscale IPv4 address."
  exit 1
fi

export ORBIT_ALLOW_REMOTE=true
export ORBIT_REMOTE_SCOPE=tailscale
export HOST=0.0.0.0

echo "Starting Orbit in tailnet-only mode."
if [[ "$auto_token_provision" == "false" ]]; then
  echo "ORBIT_TAILNET_AUTO_TOKEN=false -> no preconfigured token (first-setup mode)"
  echo "Open from another device: http://${TS_IP}:3000/login"
elif [[ "$token_generated" == "true" ]]; then
  if [[ "$token_rotated" == "true" ]]; then
    echo "ORBIT_ACCESS_TOKEN rotated and saved to ${token_file}"
  else
    echo "ORBIT_ACCESS_TOKEN generated and saved to ${token_file}"
  fi
  echo "Pair from another device: http://${TS_IP}:3000/login?token=${ORBIT_ACCESS_TOKEN}&next=/"
else
  echo "Using existing ORBIT_ACCESS_TOKEN (set env or ${token_file})"
  echo "Open from another device: http://${TS_IP}:3000/login"
fi

exec npm run dev
