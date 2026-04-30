# Orbit macOS Electron Preview — 2026-04-30

> **상태**: 완료
> **Phase**: Desktop preview
> **keywords**: `electron` `macOS` `desktop-preview` `loopback` `ssh-tunnel` `session-only-token` `preload-isolation`

---

## 요구사항

Orbit을 원본 repo가 아닌 `~/Orbit-mac` 복사본에서 macOS Electron developer-preview 앱으로 실행할 수 있게 한다. 사용자는 This Mac, Remote URL, SSH Tunnel 중 하나를 선택해 Orbit에 접속할 수 있어야 하며, 원격 페이지에는 데스크톱 권한 API를 노출하지 않는다.

## 설계

### 변경 범위

- Electron shell, preload bridge, connection picker
- Local Orbit server supervisor
- Connection profile store and SSH tunnel process lifecycle
- Desktop-local auth/cookie behavior and first-run DB bootstrap
- Developer-preview verification scripts and design documentation

### 접근 방식

Electron main process가 파일 기반 connection picker에는 preload bridge를 붙이고, 실제 Orbit 웹앱(local/remote/tunnel)은 preload 없는 별도 hardened window로 로드한다. Local mode는 app-data SQLite DB와 session-only access token으로 loopback Orbit 서버를 시작한다. Remote/tunnel token은 저장하지 않고 현재 연결의 one-shot token으로만 전달한다.

### API / 인터페이스

```typescript
type OrbitDesktopConnectionProfile =
  | { id: string; kind: "local"; name: string; port: "auto" | number; dataDir?: string }
  | { id: string; kind: "remote"; name: string; url: string }
  | {
      id: string;
      kind: "ssh-tunnel";
      name: string;
      sshHost: string;
      sshPort: number;
      sshUsername: string;
      remoteOrbitPort: number;
      localPort: "auto" | number;
      privateKeyPath?: string;
    };
```

## 구현 내역

- [x] `~/Orbit-mac` baseline commit과 rollback tag 생성
- [x] 설계 문서 작성 및 평가 에이전트 피드백 반영
- [x] OMX team으로 Electron shell, local supervisor, profile/tunnel, verification lane 구현
- [x] 평가 FAIL 항목 반영: plaintext token persistence 제거, remote/tunnel session token 경로 추가, fake packaging claim 제거
- [x] 평가 에이전트 최종 PASS 확인

### 주요 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `electron/main.ts` | picker-only preload window, Orbit content window, local/remote/tunnel connection orchestration |
| `electron/serverSupervisor.ts` | app-data DB bootstrap, session-only token, loopback server child lifecycle |
| `electron/profileStore.ts` | persisted profile sanitization and secret-field rejection |
| `electron/tunnel.ts` | argv-based OpenSSH forwarding, readiness/error handling, cleanup |
| `server.ts` | loopback-gated `ORBIT_DESKTOP_LOCAL` cookie behavior |
| `src/server/auth/accessTokenStore.ts` | desktop session-only auth mode bypasses token-file persistence |
| `scripts/desktop-smoke.mjs` | desktop preview acceptance smoke with security/packaging boundary checks |
| `docs/orbit-mac-electron-design.md` | final preview design and packaging boundary |

## 테스트

- [x] `npm run desktop:typecheck`
- [x] `npm run desktop:smoke` → 15/15
- [x] `npm run desktop:preview`
- [x] `npx tsc --noEmit`
- [x] `npm run lint`
- [x] `DATABASE_URL=file:/tmp/orbit-mac-desktop-smoke-2.db node scripts/desktop-db-bootstrap.mjs`
- [x] Local supervisor runtime smoke with temporary app data reached HTTP readiness and stopped cleanly

## 회고

### 잘된 점

- 설계 평가와 구현 평가를 분리해 권한 경계와 secret persistence 문제를 최종 반영 전에 잡았다.
- `desktop:pack`을 제거하고 `desktop:preview`로 바꿔 실제 packaged app이 아닌 상태를 명확히 했다.

### 개선할 점

- 실제 `.app` packaging, notarization, native rebuild, Prisma engine placement는 별도 production packaging pass로 남았다.
- Remote/tunnel one-shot token은 기존 Orbit auth 호환을 위해 query string을 쓰므로, 이후 auth endpoint 기반 주입으로 줄이는 것이 좋다.

### 교훈 → `tasks/lessons.md` 반영 여부

- [x] 반영 불필요

## 관련 노트

- 선행: `docs/orbit-mac-electron-design.md`
- 후속: production packaging, Keychain-backed token store, auth endpoint token injection
