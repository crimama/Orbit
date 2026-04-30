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
  | {
      id: string;
      kind: "local";
      name: string;
      port: "auto" | number;
      dataDir?: string;
    }
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

| 파일                                  | 변경 내용                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `electron/main.ts`                    | picker-only preload window, Orbit content window, local/remote/tunnel connection orchestration |
| `electron/serverSupervisor.ts`        | app-data DB bootstrap, session-only token, loopback server child lifecycle                     |
| `electron/profileStore.ts`            | persisted profile sanitization and secret-field rejection                                      |
| `electron/tunnel.ts`                  | argv-based OpenSSH forwarding, readiness/error handling, cleanup                               |
| `server.ts`                           | loopback-gated `ORBIT_DESKTOP_LOCAL` cookie behavior                                           |
| `src/server/auth/accessTokenStore.ts` | desktop session-only auth mode bypasses token-file persistence                                 |
| `scripts/desktop-smoke.mjs`           | desktop preview acceptance smoke with security/packaging boundary checks                       |
| `docs/orbit-mac-electron-design.md`   | final preview design and packaging boundary                                                    |

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

---

## Update: packaged local mode — 2026-04-30

> **keywords**: `electron` `macOS` `packaged-local` `this-mac` `prisma` `node-pty` `electron-abi`

### 요구사항

Remote URL 전용 `.app` 다음 단계로, packaged Electron app 안에서 `This Mac`이 로컬 Orbit 서버를 직접 시작할 수 있어야 한다.

### 구현 결정

- Remote 전용 패키징은 유지하고, local-capable packaging을 `desktop:pack:local`로 분리한다.
- packaged local runtime은 `.next/BUILD_ID`, `dist/server.js`, `scripts/desktop-db-bootstrap.mjs`, `prisma/schema.prisma`가 앱 root에 있을 때만 활성화한다.
- `server.ts`는 `tsconfig.server.json`으로 `dist/server.js`에 컴파일하고, `@/...` require를 풀기 위해 `dist/node_modules/@/{server,lib}` alias shim을 생성한다.
- local package는 `asar: false`를 사용한다. Electron-as-Node child process가 `.next`, compiled server, Prisma, native modules를 실제 파일 경로에서 읽게 하기 위해서다.
- local package는 `npmRebuild: false`로 electron-builder의 전체 native rebuild를 끈다. `ssh2`의 optional `cpu-features` rebuild가 `This Mac`과 무관하게 실패할 수 있기 때문이다.
- 필요한 native module은 `desktop:rebuild:local-native`에서 `electron-rebuild -f -w node-pty`로 좁혀서 처리한다.
- app-data SQLite DB와 session-only access token 모델은 기존 desktop local supervisor 흐름을 그대로 유지한다.

### 검증

- `npm run desktop:build`
- `env -u DATABASE_URL npm run build`
- `npm run desktop:local-server-build`
- 임시 SQLite DB + `NODE_PATH=dist/node_modules node dist/server.js` runtime smoke
  - `/login` 200
  - `/?token=smoke-token` 302 + `orbit_token` cookie

### 남은 macOS 검증

- `cpu-features` native rebuild failure를 피하기 위해 broad electron-builder rebuild는 비활성화했다.
- MacBook에서 실행하면 `desktop:rebuild:local-native`가 `node-pty`만 Electron ABI로 rebuild해야 한다.
- 최종 완료 판정은 MacBook에서 generated `.app`를 열고 `This Mac` 연결이 성공하는지 확인한 뒤 내린다.
