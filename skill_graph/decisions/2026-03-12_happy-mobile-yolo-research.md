# Happy Coder 모바일 최적화 + YOLO 모드 리서치 — 2026-03-12

> **상태**: 완료
> **유형**: research / decision
> **keywords**: `happy-coder` `모바일` `yolo` `E2E암호화` `device-switch` `push-notification` `permission` `Expo` `Socket.io` `RPC`

---

## 개요

[Happy Coder](https://github.com/slopus/happy) — Claude Code / Codex를 모바일에서 원격 제어하는 E2E 암호화 클라이언트.
Orbit에 적용 가능한 모바일 최적화, YOLO 모드, 디바이스 스위칭 패턴을 분석한다.

---

## 1. 아키텍처 요약

```
packages/
├── app/           # Expo (React Native) — iOS/Android/Web 유니버설 클라이언트
├── cli/           # CLI 래퍼 데몬 + RPC 브릿지
├── server/        # Fastify + Socket.IO + Postgres + Redis
├── agent/         # 원격 세션 관리 에이전트
└── happy-wire/    # 공유 와이어 프로토콜 스키마 (단일 소스 of truth)
```

### 통신 흐름

```
[Mobile App (Expo)]
    ↕ Socket.IO (E2E 암호화)
[Server (Fastify + Redis pub/sub)]
    ↕ Socket.IO (Machine-scoped)
[CLI Daemon (localhost)]
    ↕ PTY / SDK
[Claude Code / Codex]
```

### Socket.IO 연결 스코프 (3종)

| 스코프 | 용도 | 구독 범위 |
|--------|------|----------|
| **User-scoped** | 사용자의 모든 세션 업데이트 | 전체 세션 목록, 머신 상태 |
| **Session-scoped** | 단일 세션의 실시간 데이터 | 메시지, 도구 호출, 턴 진행 |
| **Machine-scoped** | 데몬 하트비트 + RPC | 머신 연결 상태, 원격 명령 |

---

## 2. 모바일 UI/UX 최적화

### 2.1 기술 스택

- **Expo (React Native)** — 단일 코드베이스로 iOS/Android/Web
- **Socket.IO** — 실시간 세션 스트리밍 (WebSocket + 폴백)
- **E2E 암호화** — 서버 블라인드 아키텍처 (클라이언트에서 암/복호화)

### 2.2 핵심 모바일 패턴

#### 이벤트 분리: Persistent vs Ephemeral

```
Persistent (DB 저장, 순서 보장)
├── new-session, update-session, delete-session
├── new-message (암호화된 에이전트 메시지)
├── new-machine, update-machine
└── artifact CRUD

Ephemeral (메모리 전용, 디바운싱)
├── activity — 세션 존재 + 현재 thinking 상태
├── machine-activity — 데몬 연결 상태
├── usage — 토큰/비용 리포팅
└── machine-status — 연결 상태 변경
```

**Orbit 적용**: 현재 Orbit의 Socket.io 이벤트를 persistent/ephemeral로 분리하면 모바일 대역폭 절약 가능.

#### Presence 최적화

- 고빈도 이벤트(activity)는 **메모리 디바운싱** 후 배치 DB 쓰기
- 10분 미활동 시 타임아웃 마킹
- 모바일 배터리 / 대역폭 절약의 핵심

#### Delta 전송

- 터미널 스트림에 Delta 인코딩 적용 (특히 모바일)
- Orbit의 기존 `DeltaStream` 모듈과 동일 개념

### 2.3 세션 프로토콜 (Unified Event Envelope)

```typescript
interface SessionEvent {
  id: string;          // cuid2
  time: number;        // unix ms
  role: "user" | "agent";
  turn?: string;       // cuid2 (에이전트 메시지에만)
  subagent?: string;   // cuid2 (중첩 에이전트)
  ev: EventBody;       // 이벤트 타입으로 구분
}

// 9개 이벤트 타입
type EventBody =
  | { t: "text"; content: string; thinking?: string }
  | { t: "service"; status: string }
  | { t: "tool-call-start"; name: string; args: any }
  | { t: "tool-call-end"; callId: string; result: any }
  | { t: "file"; ref: string; metadata: any }
  | { t: "turn-start" }
  | { t: "turn-end"; status: "completed" | "failed" | "cancelled" }
  | { t: "start" }   // 서브에이전트 시작
  | { t: "stop" };   // 서브에이전트 종료
```

**Orbit 적용**: PTY 원시 바이트 스트림 + 이 구조화된 이벤트 스트림을 병행하면, 모바일에서는 구조화된 뷰(도구 호출 목록, 상태 표시 등)를 보여주고 데스크탑에서는 풀 터미널을 보여줄 수 있다.

---

## 3. YOLO 모드 구현

### 3.1 퍼미션 모드 체계

```typescript
type PermissionMode =
  | "default"            // 매 도구 호출마다 승인 필요
  | "acceptEdits"        // 파일 수정은 자동 승인
  | "bypassPermissions"  // 모든 권한 자동 승인 (= yolo)
  | "plan"               // 읽기 전용 + 계획만
  | "read-only"          // 읽기 전용
  | "safe-yolo"          // 안전한 것만 자동 승인
  | "yolo";              // bypassPermissions로 매핑
```

### 3.2 YOLO 매핑 로직

```
사용자 선택: "yolo"      → 내부: bypassPermissions (모든 권한 우회)
사용자 선택: "safe-yolo" → 내부: default (안전한 것만 자동 승인)
```

### 3.3 퍼미션 해석 우선순위 (Resolution Chain)

```
1. 인메모리 상태 (앱에서 실시간 변경)     ← 최우선
2. 로컬 스토리지 (디바이스별 설정)
3. 서버 페이로드 (서버 기본값)
4. 샌드박스 폴백 (안전 잠금)              ← 최후
```

### 3.4 샌드박스 안전 장치

- 샌드박스 모드가 활성화되면 **어떤 퍼미션 모드든 `bypassPermissions`으로 강제**
- 즉, 샌드박스 안에서는 모든 것이 자동 승인 (격리 환경이므로 안전)
- 샌드박스 밖에서 yolo를 선택하면 사용자의 명시적 동의 필요

### 3.5 모바일에서의 YOLO 전환 흐름

```
[모바일 앱]
  → 세션 상세 화면
    → 퍼미션 모드 토글 (드롭다운/스위치)
      → Socket.IO로 서버에 전송
        → 서버가 CLI 데몬에 릴레이
          → CLI가 Claude Code의 --dangerously-skip-permissions 플래그 또는
             내부 상태 변경으로 반영
```

**핵심**: 모바일에서 실시간으로 퍼미션 모드를 변경할 수 있고, 이것이 즉시 실행 중인 에이전트에 반영됨.

---

## 4. 디바이스 스위칭

### 4.1 메커니즘

- 같은 세션을 iOS, Android, Web, CLI에서 **동시 접근** 가능
- 서버가 E2E 암호화 릴레이 역할
- **키보드 입력 감지** → 데스크탑 제어권 자동 복구

### 4.2 Presence 인식

```
[모바일에서 YOLO 모드 켜고 방치]
  → 에이전트가 작업 수행 중
    → 데스크탑에서 키 하나 누름
      → machine-activity 이벤트로 활성 디바이스 전환
        → 입력 포커스가 데스크탑으로 이동
```

### 4.3 충돌 해소

- **Versioned updates** + `expectedVersion` 패턴
- 버전 불일치 시 클라이언트에 conflict 응답
- 낙관적 동시성 제어 (Optimistic Concurrency Control)

---

## 5. 푸시 알림

- 디바이스별 푸시 토큰 등록 (`/v1/push-tokens`)
- 퍼미션 요청 발생 시 → 서버가 푸시 전송
- 에러/실패 시에도 알림
- 모바일이 백그라운드여도 알림으로 즉시 인지 가능

---

## 6. E2E 암호화

### 이중 변형

| 변형 | 알고리즘 | 키 | 용도 |
|------|---------|-----|------|
| Legacy | XSalsa20-Poly1305 (NaCl secretbox) | 32B 공유 시크릿 | 하위 호환 |
| DataKey | AES-256-GCM | 세션/머신별 32B 키 (임시 키페어) | 현재 표준 |

### 암호화 대상
- 세션 메타데이터 + 에이전트 상태
- 메시지 내용 (코드, 프롬프트)
- 머신 메타데이터 + 데몬 상태
- 아티팩트 헤더 + 바디
- KV 스토어 값

**서버는 암호화된 바이트만 릴레이** — 코드 내용을 볼 수 없음.

---

## 7. Orbit 적용 방안

### 7.1 즉시 적용 가능 (기존 인프라 활용)

| 패턴 | Happy 구현 | Orbit 현재 | 적용 방법 |
|------|-----------|------------|----------|
| **YOLO 모드 토글** | 모바일 UI에서 퍼미션 모드 실시간 변경 | InterceptorModal/Banner | 모바일 레이아웃에 퍼미션 모드 스위처 추가 |
| **이벤트 분리** | persistent/ephemeral 분리 | 단일 이벤트 스트림 | Socket 이벤트에 ephemeral 플래그 추가 |
| **Presence 디바운싱** | 메모리 디바운싱 + 배치 쓰기 | 없음 | sessionManager에 presence 배치 로직 추가 |
| **퍼미션 해석 체인** | 4단계 resolution | 단일 레벨 | 다중 소스 퍼미션 해석 체인 구현 |

### 7.2 중기 적용 (새 모듈 필요)

| 패턴 | 구현 범위 |
|------|----------|
| **디바이스 스위칭** | Socket.io 세션에 device-id 추가 + 활성 디바이스 추적 |
| **푸시 알림** | PWA Push API + 서버 푸시 엔드포인트 (현재 브라우저 Notification만 있음) |
| **구조화된 이벤트 스트림** | PTY 원시 스트림 + 파싱된 이벤트 뷰 병행 |

### 7.3 장기 검토 (아키텍처 변경)

| 패턴 | 검토 사항 |
|------|----------|
| **E2E 암호화** | SSH 세션의 코드 보호 필요 시 AES-256-GCM 레이어 추가 |
| **Wire 프로토콜 분리** | happy-wire처럼 공유 스키마 패키지 분리 (클라/서버 타입 일치) |

---

## 8. 핵심 교훈

1. **퍼미션 모드를 상태로 관리** — 고정 플래그가 아니라 실시간 변경 가능한 상태로 설계
2. **ephemeral 이벤트 분리가 모바일 성능의 핵심** — DB 쓰기 없이 메모리에서 디바운싱
3. **서버 블라인드 릴레이** — E2E 암호화로 서버 신뢰 불필요, 보안 + 프라이버시 동시 확보
4. **Unified Event Envelope** — 9개 이벤트 타입으로 에이전트 세션의 모든 상태를 표현 가능
5. **디바이스 스위칭은 presence + 입력 감지** — 복잡한 핸드오프 프로토콜 불필요

---

## 관련 노트

- 선행: [Phase 2-4 병렬](../features/2026-02-28_phase2-4-parallel.md) — 모바일/PWA/인터셉터 구현
- 선행: [하네스 엔지니어링 ADR](./2026-02-28_harness-engineering.md) — 가드레일/인터셉터 패턴
- 연관: [터미널 에코시스템 리서치](./2026-03-12_libghostty-terminal-ecosystem-research.md) — 세션 퍼시스턴스 패턴
- 후속: 모바일 YOLO 모드 UI 구현, 이벤트 분리 리팩토링
