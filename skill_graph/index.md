# Update Notes Index

> 프로젝트 변경 기록의 키워드 기반 인덱스.
> 키워드 → 문서 링크로 그래프 탐색 가능.

---

## 키워드 그래프

```
                        ┌─────────┐
              ┌────────▶│   SSH   │◀──────────┐
              │         └────┬────┘           │
              │              │                │
         ┌────┴────┐    ┌───▼────┐     ┌─────┴──────┐
         │   PWA   │    │ Delta  │     │  원격(SSH)  │
         └────┬────┘    └───┬────┘     └─────┬──────┘
              │             │                │
         ┌────▼────┐       │          ┌─────▼──────┐
         │  모바일  │       │          │ RemotePty  │
         └─────────┘       │          └────────────┘
                           │
  ┌──────────┐      ┌─────▼──────┐      ┌───────────────┐
  │ terminal │◀────▶│  socket.io │◀────▶│  인터셉터     │
  └─────┬────┘      └─────┬──────┘      └───────┬───────┘
        │                 │                      │
   ┌────▼────┐     ┌─────▼──────┐        ┌─────▼──────┐
   │   pty   │     │  session   │        │  A/B비교   │
   └────┬────┘     └────────────┘        └────────────┘
        │
   ┌────▼──────────┐
   │ custom-server  │
   └───────────────┘

  ┌──────────────┐      ┌────────────┐
  │  React Flow  │◀────▶│ 스킬그래프 │
  └──────┬───────┘      └─────┬──────┘
         │                    │
    ┌────▼────┐        ┌─────▼──────┐
    │  skill  │◀──────▶│  워크플로우 │
    └─────────┘        └────────────┘

  ┌─────────────────────────────────────────────────────┐
  │              터미널 에코시스템 리서치                    │
  │                                                     │
  │  ┌────────────┐   ┌──────────────┐   ┌───────────┐ │
  │  │ ghostty-web│   │   restty     │   │   zmx     │ │
  │  │ xterm 대체 │   │  WebGPU 렌더 │   │ 세션지속  │ │
  │  └─────┬──────┘   └──────┬───────┘   └─────┬─────┘ │
  │        │                 │                  │       │
  │  ┌─────▼──────┐   ┌──────▼───────┐   ┌─────▼─────┐ │
  │  │libghostty  │   │    WASM      │   │   mux     │ │
  │  │  vt-core   │   │  브라우저 VT │   │에이전트   │ │
  │  └────────────┘   └──────────────┘   │병렬 격리  │ │
  │                                      └───────────┘ │
  └─────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────┐
  │                  하네스 레이어                        │
  │                                                     │
  │  ┌────────────┐   ┌──────────────┐   ┌───────────┐ │
  │  │  가드레일   │   │ 옵저버빌리티  │   │ 세션포크  │ │
  │  │golden-path │   │  파이프라인  │   │ 스냅샷    │ │
  │  └─────┬──────┘   └──────┬───────┘   └─────┬─────┘ │
  │        │                 │                  │       │
  │  ┌─────▼──────┐   ┌──────▼───────┐   ┌─────▼─────┐ │
  │  │ interceptor│   │  traceDetect │   │  session  │ │
  │  └────────────┘   └──────────────┘   │  Manager  │ │
  │                                      └───────────┘ │
  │  ┌────────────────────┐   ┌─────────────────────┐  │
  │  │ 아키텍처 강제       │   │ 컨텍스트 엔지니어링  │  │
  │  │ ESLint boundary    │   │ AGENTS.md 계층       │  │
  │  └────────────────────┘   └─────────────────────┘  │
  └─────────────────────────────────────────────────────┘
```

---

## 키워드 → 문서 매핑

| 키워드              | 문서                                                                                                                | 카테고리          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **pty**             | [Phase 1 인프라](features/2026-02-27_phase1-infra.md)                                                               | feature           |
| **terminal**        | [Phase 1 인프라](features/2026-02-27_phase1-infra.md)                                                               | feature           |
| **xterm**           | [Phase 1 인프라](features/2026-02-27_phase1-infra.md)                                                               | feature           |
| **socket.io**       | [Phase 1 인프라](features/2026-02-27_phase1-infra.md)                                                               | feature           |
| **custom-server**   | [Phase 1 인프라](features/2026-02-27_phase1-infra.md)                                                               | feature           |
| **session**         | [Phase 1 인프라](features/2026-02-27_phase1-infra.md)                                                               | feature           |
| **dashboard**       | [Phase 1 인프라](features/2026-02-27_phase1-infra.md)                                                               | feature           |
| **SSH**             | [Phase 2-4 병렬](features/2026-02-28_phase2-4-parallel.md)                                                          | feature           |
| **PWA**             | [Phase 2-4 병렬](features/2026-02-28_phase2-4-parallel.md)                                                          | feature           |
| **모바일**          | [Phase 2-4 병렬](features/2026-02-28_phase2-4-parallel.md)                                                          | feature           |
| **스킬그래프**      | [Phase 2-4 병렬](features/2026-02-28_phase2-4-parallel.md)                                                          | feature           |
| **React Flow**      | [Phase 2-4 병렬](features/2026-02-28_phase2-4-parallel.md)                                                          | feature           |
| **인터셉터**        | [Phase 2-4 병렬](features/2026-02-28_phase2-4-parallel.md)                                                          | feature           |
| **Delta**           | [Phase 2-4 병렬](features/2026-02-28_phase2-4-parallel.md)                                                          | feature           |
| **A/B비교**         | [Phase 2-4 병렬](features/2026-02-28_phase2-4-parallel.md)                                                          | feature           |
| **oh-my-opencode**  | [프로젝트 하네스 + UX](features/2026-02-28_project-harness-oh-my-opencode-chat-ux.md)                               | feature           |
| **chat-ui**         | [프로젝트 하네스 + UX](features/2026-02-28_project-harness-oh-my-opencode-chat-ux.md)                               | feature           |
| **project-harness** | [프로젝트 하네스 + UX](features/2026-02-28_project-harness-oh-my-opencode-chat-ux.md)                               | feature           |
| **skill**           | [스킬 전략 ADR](decisions/2026-02-27_skill-strategy.md), [Phase 2-4 병렬](features/2026-02-28_phase2-4-parallel.md) | decision, feature |
| **워크플로우**      | [스킬 전략 ADR](decisions/2026-02-27_skill-strategy.md)                                                             | decision          |
| **자동화**          | [스킬 전략 ADR](decisions/2026-02-27_skill-strategy.md)                                                             | decision          |
| **phase**           | [스킬 전략 ADR](decisions/2026-02-27_skill-strategy.md)                                                             | decision          |
| **link-notes**      | [스킬 전략 ADR](decisions/2026-02-27_skill-strategy.md)                                                             | decision          |
| **dep-install**     | [스킬 전략 ADR](decisions/2026-02-27_skill-strategy.md)                                                             | decision          |
| **harness**         | [하네스 엔지니어링 ADR](decisions/2026-02-28_harness-engineering.md)                                                | decision          |
| **에이전트**        | [하네스 엔지니어링 ADR](decisions/2026-02-28_harness-engineering.md)                                                | decision          |
| **observability**   | [하네스 엔지니어링 ADR](decisions/2026-02-28_harness-engineering.md)                                                | decision          |
| **guardrail**       | [하네스 엔지니어링 ADR](decisions/2026-02-28_harness-engineering.md)                                                | decision          |
| **golden-path**     | [하네스 엔지니어링 ADR](decisions/2026-02-28_harness-engineering.md)                                                | decision          |
| **컨텍스트**        | [하네스 엔지니어링 ADR](decisions/2026-02-28_harness-engineering.md)                                                | decision          |
| **GC에이전트**      | [하네스 엔지니어링 ADR](decisions/2026-02-28_harness-engineering.md)                                                | decision          |
| **세션포크**        | [하네스 엔지니어링 ADR](decisions/2026-02-28_harness-engineering.md)                                                | decision          |
| **libghostty**      | [터미널 에코시스템 리서치](decisions/2026-03-12_libghostty-terminal-ecosystem-research.md)                          | decision/research |
| **ghostty-web**     | [터미널 에코시스템 리서치](decisions/2026-03-12_libghostty-terminal-ecosystem-research.md)                          | decision/research |
| **restty**          | [터미널 에코시스템 리서치](decisions/2026-03-12_libghostty-terminal-ecosystem-research.md)                          | decision/research |
| **WebGPU**          | [터미널 에코시스템 리서치](decisions/2026-03-12_libghostty-terminal-ecosystem-research.md)                          | decision/research |
| **WASM**            | [터미널 에코시스템 리서치](decisions/2026-03-12_libghostty-terminal-ecosystem-research.md)                          | decision/research |
| **zmx**             | [터미널 에코시스템 리서치](decisions/2026-03-12_libghostty-terminal-ecosystem-research.md)                          | decision/research |
| **mux**             | [터미널 에코시스템 리서치](decisions/2026-03-12_libghostty-terminal-ecosystem-research.md)                          | decision/research |
| **session-persist** | [터미널 에코시스템 리서치](decisions/2026-03-12_libghostty-terminal-ecosystem-research.md)                          | decision/research |

---

## 문서 → 키워드 역매핑

### features/

| 문서                                                                                  | Phase | 상태 | 키워드                                                                      |
| ------------------------------------------------------------------------------------- | ----- | ---- | --------------------------------------------------------------------------- |
| [Phase 1 인프라](features/2026-02-27_phase1-infra.md)                                 | 1     | 🟢   | `pty` `terminal` `socket.io` `custom-server` `session` `dashboard` `xterm`  |
| [Phase 2-4 병렬](features/2026-02-28_phase2-4-parallel.md)                            | 2/3/4 | 🟢   | `SSH` `PWA` `모바일` `스킬그래프` `React Flow` `인터셉터` `Delta` `A/B비교` |
| [프로젝트 하네스 + UX](features/2026-02-28_project-harness-oh-my-opencode-chat-ux.md) | 4     | 🟢   | `harness` `project-harness` `oh-my-opencode` `chat-ui` `session-ux`         |

### decisions/

| 문서                                                                 | 상태 | 키워드                                                                                            |
| -------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------- |
| [스킬 전략 ADR](decisions/2026-02-27_skill-strategy.md)              | 완료 | `skill` `phase` `link-notes` `dep-install` `워크플로우` `자동화`                                  |
| [하네스 엔지니어링 ADR](decisions/2026-02-28_harness-engineering.md) | 완료 | `harness` `에이전트` `observability` `guardrail` `golden-path` `컨텍스트` `GC에이전트` `세션포크` |
| [터미널 에코시스템 리서치](decisions/2026-03-12_libghostty-terminal-ecosystem-research.md) | 완료 | `libghostty` `ghostty-web` `restty` `WebGPU` `WASM` `zmx` `mux` `session-persist` |

### bugfix/

_(아직 없음)_

### refactor/

| 문서                                                                       | 상태 | 영향            | 키워드                                                                                   |
| -------------------------------------------------------------------------- | ---- | --------------- | ---------------------------------------------------------------------------------------- |
| [최근 5파일 단순화](refactor/2026-03-01_simplify-recent.md)               | 🟢   | 200줄 감소      | `interceptor` `sessionManager` `MultiTerminal` `ProjectHarnessPanel` `Dashboard` 중복제거 |

### devops/

_(아직 없음)_

---

## 문서 간 연결 (관련 노트)

```
decisions/2026-02-27_skill-strategy.md
        │
        ▼ (선행)
features/2026-02-27_phase1-infra.md
        │
        ▼ (선행)
features/2026-02-28_phase2-4-parallel.md
        │
        ├──▶ decisions/2026-02-28_harness-engineering.md (방향 ADR)
        │
        ▼ (후속 예정)
??? E2E 테스트 / 성능 최적화 / 프로덕션 배포 / 하네스 패턴 구현

decisions/2026-03-12_libghostty-terminal-ecosystem-research.md
        │
        ├──▶ features/2026-02-27_phase1-infra.md (xterm.js 대체재 평가)
        ├──▶ features/2026-02-28_phase2-4-parallel.md (SSH + RemotePty 세션 퍼시스턴스)
        └──▶ decisions/2026-02-28_harness-engineering.md (인터셉터 플러그인 패턴)
```

---

## 타임라인

| 날짜       | 문서                                                                                  | 요약                                                                                       |
| ---------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 2026-02-27 | [스킬 전략](decisions/2026-02-27_skill-strategy.md)                                   | `/phase`, `/link-notes`, `/dep-install` 스킬 추가 결정                                     |
| 2026-02-27 | [Phase 1](features/2026-02-27_phase1-infra.md)                                        | PTY + xterm.js + Socket.io + 세션 resume 인프라                                            |
| 2026-02-28 | [Phase 2-4](features/2026-02-28_phase2-4-parallel.md)                                 | SSH + PWA + 그래프 + 인터셉터 + A/B 비교 병렬 구현                                         |
| 2026-02-28 | [하네스 엔지니어링 ADR](decisions/2026-02-28_harness-engineering.md)                  | 6대 하네스 패턴 체계화 (아키텍처 강제, 컨텍스트, 옵저버빌리티, Golden Path, GC, 세션 포크) |
| 2026-02-28 | [프로젝트 하네스 + UX](features/2026-02-28_project-harness-oh-my-opencode-chat-ux.md) | 프로젝트 단위 하네스 설정 + oh-my-opencode 프리셋 + 세션 UI 개선                           |
| 2026-03-01 | [최근 5파일 단순화](refactor/2026-03-01_simplify-recent.md)                          | 중복 제거 + 복잡도 감소: interceptor(I1-5) + sessionManager(S1-4) + MultiTerminal(M1-4) + ProjectHarnessPanel(H1-5) + Dashboard(D1-5) |
| 2026-03-12 | [터미널 에코시스템 리서치](decisions/2026-03-12_libghostty-terminal-ecosystem-research.md) | libghostty/ghostty-web/restty/zmx/mux 분석. xterm.js 대체재 평가 + 세션 퍼시스턴스/에이전트 병렬화 패턴 수집 |
