# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Principle

**"어떠한 환경에서도, 사용자의 AI 에이전트와 스킬을 시각적으로 통제하고 지속시키는 지휘 통제실"**
- 복잡함을 숨기고 단순한 인터페이스를 제공한다
- 로컬과 원격의 경계를 없앤다
- 모바일에서도 데스크탑과 동등한 제어권을 보장한다

## Project Summary

**Agent-Orbit**은 AI 에이전트(Claude Code, Codex 등) 오케스트레이션 플랫폼이다.
로컬/원격(SSH) 서버의 에이전트를 하나의 웹 대시보드에서 관리하며,
세션 지속성(resume), 시각적 스킬 그래프, 모바일 PWA 환경을 제공한다.

## Commands

```bash
# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 프로덕션 실행
npm start

# 타입 체크
npx tsc --noEmit

# 린트
npm run lint

# 테스트
npm test
```

## Architecture

### Pipeline / Data Flow

```
[Client: Next.js + xterm.js + React Flow]
        ↕ Socket.io (WebSocket)
[Backend: Node.js (TypeScript)]
    ├── PTY Manager (node-pty) ── 로컬/원격 터미널 프로세스 유지
    ├── SSH Tunnel (ssh2) ── 원격 서버 쉘/파일시스템 접근
    └── Session Watcher ── 세션 파일 실시간 감시 → UI 갱신
        ↕
[Target: Local/Remote 에이전트 인프라]
```

### Key Modules

- `src/app/` — Next.js App Router 페이지 및 레이아웃
- `src/components/` — UI 컴포넌트
  - `terminal/` — xterm.js 터미널 컴포넌트
  - `graph/` — React Flow 스킬 그래프 컴포넌트
  - `dashboard/` — 프로젝트/세션 대시보드
  - `mobile/` — 모바일 전용 UI (가상 키보드 등)
- `src/server/` — 백엔드 로직
  - `pty/` — PTY 프로세스 매니저
  - `ssh/` — SSH 터널링 및 원격 연결
  - `session/` — 세션 인덱싱 및 resume 관리
  - `socket/` — Socket.io 이벤트 핸들러
- `src/lib/` — 공유 유틸리티 및 타입
- `prisma/` — Prisma 스키마 및 마이그레이션

### Conventions

- TypeScript strict mode 사용
- 컴포넌트: PascalCase (`TerminalView.tsx`)
- 유틸리티/서버: camelCase (`ptyManager.ts`)
- API 라우트: Next.js App Router (`src/app/api/`)
- 실시간 통신: Socket.io 이벤트명은 `kebab-case` (`terminal-data`, `session-update`)
- DB 접근: Prisma Client를 통한 타입 안전 쿼리

## Dependencies

### Core
- **Next.js 14** (App Router) — SSR + 클라이언트 대시보드
- **TypeScript** — 타입 안전성
- **Socket.io** — 실시간 양방향 통신
- **Prisma + SQLite** — 메타데이터 저장

### Terminal & SSH
- **xterm.js + WebGL Addon** — 하드웨어 가속 터미널 렌더링
- **node-pty** — PTY 프로세스 관리
- **ssh2** — SSH 터널링

### Visualization
- **React Flow (XyFlow)** — 스킬/에이전트 그래프 시각화

### Mobile
- **PWA (next-pwa)** — 프로그레시브 웹 앱

---

## Workflow Orchestration

### 1. Plan Node Default
- 3단계 이상이거나 아키텍처 결정이 필요한 작업은 **반드시 plan mode 먼저**
- 작업 중 예상치 못한 문제가 생기면 STOP → 즉시 재계획. 억지로 밀어붙이지 말 것
- 구현뿐 아니라 **검증 단계**에도 plan mode 활용

### 2. Subagent Strategy
- 메인 컨텍스트 윈도우를 깨끗하게 유지하기 위해 **서브에이전트를 적극 활용**
- 리서치, 탐색, 병렬 분석은 서브에이전트에 오프로드
- 서브에이전트 하나에 한 가지 작업만 (focused execution)

### 3. Self-Improvement Loop
- **사용자의 수정/지적이 있을 때마다**: `tasks/lessons.md`에 해당 패턴을 기록
- 세션 시작 시 `tasks/lessons.md`를 먼저 확인하여 과거 교훈 리뷰
- 반복 검증된 패턴은 `update_notes/analysis/{주제}/_lessons.md`로 승격

### 4. Verification Before Done
- **작동을 증명하지 않은 채 완료 처리 금지**
- "시니어 엔지니어가 이 코드를 승인할 것인가?" 자문
- 테스트 실행, 로그 확인, 정확성 시연 후 완료

### 5. Demand Elegance (Balanced)
- 비자명한 변경에는 "더 우아한 방법이 있지 않은가?" 자문
- 수정이 hacky하게 느껴지면 우아한 해결책으로 재구현
- 단순·명백한 수정에는 생략 — 과잉 설계 금지

### 6. Autonomous Bug Fixing
- 버그 리포트가 주어지면: **그냥 고친다**. 손을 잡아달라고 하지 말 것
- 로그, 에러, 실패 테스트를 직접 분석하여 해결

---

## Memory Management

프로젝트 영속 메모리는 `~/.claude/projects/-home-hun-Volume-Orbit/memory/`에 위치한다.

### 구조
```
memory/
├── MEMORY.md          # 핵심 요약 (매 세션 자동 로드, 200줄 제한)
├── architecture.md    # 아키텍처 상세 결정 및 변경 이력
├── patterns.md        # 코드 패턴, 컨벤션, 반복 사용 스니펫
└── debugging.md       # 디버깅 인사이트, 환경 이슈, 해결책
```

### 규칙
- **MEMORY.md**: 프로젝트 오버뷰, 핵심 결정, 현재 상태만 간결하게 유지 (200줄 이내)
- **토픽 파일**: 상세 내용은 별도 파일로 분리하고 MEMORY.md에서 링크
- **갱신 시점**:
  - 아키텍처/기술 결정 변경 시 → `architecture.md` 갱신
  - 반복 확인된 코드 패턴 → `patterns.md` 갱신
  - 디버깅 해결책 발견 시 → `debugging.md` 갱신
  - 매 세션 종료 전 → `MEMORY.md`의 Current Status 갱신
- **중복 금지**: 새로 쓰기 전에 기존 내용 확인. 업데이트 우선
- **추측 금지**: 검증되지 않은 내용은 기록하지 않음
- `tasks/lessons.md`의 검증된 교훈 중 영속적 가치가 있는 것은 memory로 승격

---

## Task Management

1. **Plan First**: 구현 시작 전 `tasks/todo.md`에 체크리스트 형태로 계획 작성
2. **Verify Plan**: 구현 착수 전 계획 확인
3. **Track Progress**: 진행하면서 완료 항목에 체크
4. **Explain Changes**: 각 단계마다 고수준 요약 제공
5. **Document Results**: 완료 후 `tasks/todo.md`에 결과 섹션 추가
6. **Capture Lessons**: 수정/지적 발생 시 즉시 `tasks/lessons.md` 업데이트

```
tasks/
├── todo.md        # 현재 세션 계획·진행·결과 (세션마다 갱신)
└── lessons.md     # 수정·지적으로부터 추출한 누적 교훈 (영속적)
```

---

## Update Notes

유의미한 작업 시 반드시 `update_notes/` 아래에 `.md` 파일로 기록한다.

```
update_notes/
├── features/                     # 신규 기능 구현 기록
│   ├── _TEMPLATE.md
│   └── YYYY-MM-DD_기능명.md
├── bugfix/                       # 버그 수정 기록 (원인 분석 포함)
│   ├── _TEMPLATE.md
│   └── YYYY-MM-DD_설명.md
├── refactor/                     # 리팩토링 기록 (Before/After)
│   ├── _TEMPLATE.md
│   └── YYYY-MM-DD_설명.md
├── devops/                       # 빌드/배포/CI·CD/인프라 변경
│   ├── _TEMPLATE.md
│   └── YYYY-MM-DD_설명.md
└── decisions/                    # 아키텍처/기술 결정 기록 (ADR)
    ├── _TEMPLATE.md
    └── YYYY-MM-DD_결정명.md
```

**노트 연결:**
- 노트 간 `## 관련 노트` 섹션에 상대 경로로 링크
- 반복되는 교훈은 `tasks/lessons.md`에 누적

---

## Implementation Notes

### 보안 가드레일
- 에이전트의 위험 명령(`rm -rf /` 등) 실행 시 웹 UI에서 "승인 대기" 팝업
- 백엔드 스트림 레이어에 명령어 인터셉터 구현

### 프로세스 관리
- 브라우저 탭 닫아도 PTY 유지
- 24시간 미활동 세션 자동 GC

### 대역폭 최적화
- SSH 터미널 스트림에 Delta 전송 최적화 (특히 모바일)

---

## Agent Coordination Protocol

멀티에이전트 병렬 작업 시 파일 충돌을 방지하기 위한 규칙.

### 파일 잠금 메커니즘

- 에이전트가 파일 수정 전 `.locks/` 디렉토리에 잠금 파일 생성
- 잠금 파일명: `{파일경로에서 /를 -로 치환}.lock` (예: `src-app-page.tsx.lock`)
- 잠금 파일 내용 (JSON):
  ```json
  {
    "agent_id": "세션ID",
    "file": "대상 파일 경로",
    "lines": "수정 라인 범위 (예: '1-50' 또는 'all')",
    "timestamp": "ISO 8601",
    "description": "작업 설명"
  }
  ```
- 수정 완료 후 즉시 잠금 파일 삭제

### 에이전트 행동 규칙

1. **수정 전**: `.locks/`에 해당 파일의 잠금 존재 여부 확인
2. **잠금 없음** → 잠금 생성 후 수정 진행
3. **잠금 있음** → 라인 범위가 겹치지 않으면 동시 수정 가능, 겹치면 해당 파일 보류 → 다른 작업 선행
4. **수정 완료** → 즉시 잠금 파일 삭제

### Advisor 에이전트 역할

- 상시 존재하며 `.locks/` 상태를 모니터링
- 작업 할당 시 잠금 상태를 고려하여 병목 방지
- 교착(deadlock) 감지 및 해소
- 30분 이상 경과한 좀비 잠금 정리

---

## Core Principles

- **Simplicity First**: 모든 변경은 가능한 한 단순하게. 최소한의 코드에만 영향을 줄 것
- **No Laziness**: 근본 원인을 찾아라. 임시방편 금지. 시니어 개발자 기준을 적용
- **Minimal Impact**: 변경은 필요한 것만. 불필요한 버그 유입 방지
