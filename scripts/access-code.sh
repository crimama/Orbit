#!/usr/bin/env bash
set -euo pipefail

code_file="${ORBIT_ACCESS_CODE_FILE:-${ORBIT_ACCESS_TOKEN_FILE:-$HOME/.orbit/access-token}}"

usage() {
  cat <<'EOF'
Usage:
  orbit access-code show
  orbit access-code set <access-code>
  orbit access-code rotate

Environment:
  ORBIT_ACCESS_CODE_FILE=/custom/path
  ORBIT_ACCESS_TOKEN_FILE=/custom/path  # legacy alias
EOF
}

sanitize() {
  tr -d '\r\n' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

generate_code() {
  node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("base64url"))'
}

ensure_code_dir() {
  local dir
  dir="$(dirname "$code_file")"
  mkdir -p "$dir"
  chmod 700 "$dir" 2>/dev/null || true
}

write_code() {
  local value="$1"
  if [[ -z "$value" ]]; then
    echo "Access code cannot be empty." >&2
    exit 1
  fi
  if [[ "${#value}" -lt 8 ]]; then
    echo "Access code must be at least 8 characters." >&2
    exit 1
  fi

  ensure_code_dir
  umask 077
  printf '%s' "$value" >"$code_file"
  chmod 600 "$code_file" 2>/dev/null || true
}

read_code() {
  if [[ -s "$code_file" ]]; then
    sanitize <"$code_file"
  fi
}

command="${1:-show}"
case "$command" in
  show)
    code="$(read_code || true)"
    if [[ -z "$code" ]]; then
      echo "No access code is configured at ${code_file}."
      echo "Create one with: orbit access-code rotate"
      exit 1
    fi
    echo "Access code file: ${code_file}"
    echo "Access code: ${code}"
    ;;
  set)
    raw="${2:-}"
    code="$(printf '%s' "$raw" | sanitize)"
    write_code "$code"
    echo "Access code saved to ${code_file}"
    ;;
  rotate)
    code="$(generate_code)"
    write_code "$code"
    echo "Access code rotated and saved to ${code_file}"
    echo "Access code: ${code}"
    ;;
  help|--help|-h)
    usage
    ;;
  *)
    echo "Unknown command: ${command}" >&2
    usage >&2
    exit 1
    ;;
esac
