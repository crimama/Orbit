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

if [[ -z "${ORBIT_ACCESS_TOKEN:-}" ]]; then
  echo "ORBIT_ACCESS_TOKEN is required for tailnet mode."
  exit 1
fi

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
echo "Open from another device: http://${TS_IP}:3000/login"

exec npm run dev

