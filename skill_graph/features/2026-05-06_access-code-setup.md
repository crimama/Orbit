# Access Code Setup

## Summary

Orbit access configuration now exposes a user-facing `access code` workflow while preserving the legacy `ORBIT_ACCESS_TOKEN` environment variable and persisted token file.

## Changes

- `ORBIT_ACCESS_CODE` and `ORBIT_ACCESS_CODE_FILE` are supported as clearer aliases.
- `npm run access:code -- show|set|rotate` manages the persisted access code at `~/.orbit/access-token` by default.
- Tailnet startup accepts `ORBIT_ACCESS_CODE`, auto-generates a code when needed, and prints access-code-centered pairing guidance.
- Login and auth error copy uses access code terminology instead of password/token wording.

## Verification

- `ORBIT_ACCESS_CODE_FILE=/tmp/orbit-access-code-test npm run access:code -- rotate && ORBIT_ACCESS_CODE_FILE=/tmp/orbit-access-code-test npm run access:code -- show`
- `npx tsc --noEmit`
- `npm run lint`
