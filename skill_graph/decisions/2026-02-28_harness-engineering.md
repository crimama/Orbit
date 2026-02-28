# AI 에이전트 하네스 엔지니어링 패턴 도입 — 2026-02-28

> **분류**: 아키텍처
> **keywords**: harness, 에이전트, observability, guardrail, golden-path, 컨텍스트, GC에이전트, 세션포크

---

## 맥락

2026년은 AI 에이전트 하네스 엔지니어링(Agent Harness Engineering)의 원년이다.

### 프레임워크 vs. 하네스: 결정적 차이

| 구분 | 에이전트 프레임워크 | 에이전트 하네스 |
|------|------------------|--------------|
| 목적 | 에이전트를 **만든다** | 에이전트를 **통제한다** |
| 예시 | LangChain, CrewAI, AutoGen | Orbit, OpenAI Code Interpreter sandbox |
| 관심사 | 모델 연결, 툴 정의, 체인 구성 | 실행 경계, 옵저버빌리티, 복구, 승인 흐름 |
| 불변량 | 기능 조합 | 안전 불변량(Safety Invariants) |

현재 Orbit Phase 1-4는 하네스의 기초 구조를 갖추었다:
- `CommandInterceptor` — 위험 명령 차단 (가드레일)
- `DeltaStream` — 대역폭 최적화
- `SessionManager` — 세션 지속성 + GC
- `TraceDetector` — 스킬 호출 감지 (초보적 옵저버빌리티)

그러나 OpenAI Codex 배포 사례, Anthropic Claude Code 패턴, Martin Fowler 분석이 가리키는
"완전한 하네스"에는 아직 6가지 패턴이 체계화되지 않았다.

### 참고 소스

- OpenAI Codex: https://openai.com/index/introducing-codex/
- Anthropic Claude Code patterns: https://www.anthropic.com/engineering/claude-code-best-practices
- Martin Fowler — Bliki on Software Agents: https://martinfowler.com/bliki/SoftwareAgent.html
- Simon Willison on LLM Harnesses: https://simonwillison.net/2025/Jan/10/llm-harness/
- Hamel Husain — Evals are a harness problem: https://hamel.dev/blog/posts/evals/

---

## 선택지

| 옵션 | 장점 | 단점 |
|------|------|------|
| **A (채택): 6대 하네스 패턴 체계화** | Orbit을 진정한 지휘 통제실로 완성, 운영 신뢰성 확보 | 구현 비용 분산 필요 |
| B: 현상 유지 (Phase 1-4 완료 상태) | 추가 작업 없음 | 프레임워크 수준에 머묾, 에이전트 통제력 한계 |
| C: 서드파티 하네스 의존 (e.g. LangSmith) | 빠른 도입 | 외부 의존성, 셀프호스팅 원칙 위반, 커스터마이징 불가 |

---

## 결정

**옵션 A: 6대 하네스 패턴을 Orbit 아키텍처에 체계화**

### OpenAI 5대 원칙 (Orbit 설계 기준으로 채택)

OpenAI가 Codex 배포 시 적용한 에이전트 운영 5원칙:

1. **Minimal Footprint** — 에이전트는 필요 최소 권한만 요청
2. **Pause and Verify** — 불확실할 때 실행 전 인간에게 확인 요청
3. **Prefer Reversible Actions** — 되돌릴 수 있는 작업을 우선 선택
4. **Err on the Side of Doing Less** — 의도가 불분명하면 덜 한다
5. **Provide Full Transparency** — 모든 행동을 사람이 검토할 수 있게 기록

### 6대 하네스 패턴 및 구현 계획

#### 1. 기계적 아키텍처 강제 (Mechanical Architecture Enforcement)
- **개념**: 에이전트가 넘어서는 안 될 경계를 ESLint boundary rules, 디렉토리 구조, import 제한으로 코드 수준에서 강제
- **Orbit 대응**: ESLint `@typescript-eslint/no-restricted-imports` 룰로 `server/` → `components/` 방향 import 금지, 각 레이어 경계 강제
- **상태**: 미구현 (계획)

#### 2. 계층적 컨텍스트 엔지니어링 (Hierarchical Context Engineering)
- **개념**: 에이전트가 실행될 디렉토리마다 `AGENTS.md`를 두어 해당 스코프의 규칙·맥락·제약을 선언적으로 기술
- **Orbit 대응**: `src/server/AGENTS.md`, `src/components/AGENTS.md` 등 디렉토리별 컨텍스트 파일 체계화. CLAUDE.md는 프로젝트 루트 전역, AGENTS.md는 모듈별 로컬 가이드
- **상태**: 미구현 (계획)

#### 3. 옵저버빌리티 파이프라인 (Observability Pipeline)
- **개념**: 에이전트의 모든 실행(툴 호출, 파일 수정, 명령 실행)을 구조화된 이벤트로 방출. 단순 로그가 아닌 타입화된 이벤트 스트림
- **Orbit 대응**: `TraceDetector` 확장 → `AgentTrace` 이벤트 타입 정의, Socket.io `agent-trace` 이벤트로 프론트엔드 실시간 전달, Prisma `AgentTrace` 모델 영속화
- **현재 상태**: `TraceDetector` 기초 구현됨. 구조화 이벤트 스키마 미정의

#### 4. 가드레일 Golden Paths (Guardrail Golden Paths)
- **개념**: 위험 명령 차단뿐 아니라 "허용된 경로(Golden Path)"를 선언적으로 정의. 에이전트가 권장 경로를 따를 때 마찰 최소화, 이탈 시 자동 경고
- **Orbit 대응**: `InterceptorRule` 확장 — `block` / `warn` 외 `allow` 정책 추가. 허용 목록 기반 Allowlist 모드 지원. `/api/interceptor/rules`에 `golden-paths` 엔드포인트 추가
- **현재 상태**: `CommandInterceptor` block/warn 구현됨. Allowlist 모드 미구현

#### 5. GC 에이전트 (Entropy Management Agent)
- **개념**: 에이전트 실행 결과물(임시 파일, 고아 세션, 누적 로그)을 자동으로 정리하는 전담 에이전트. "엔트로피와의 싸움"을 자동화
- **Orbit 대응**: `SessionManager`의 24h GC 확장 — 고아 PTY 프로세스, 사용하지 않는 SSH 연결, 비어있는 스킬 노드 자동 GC. GC 이벤트를 옵저버빌리티 파이프라인으로 방출
- **현재 상태**: 24h idle GC 구현됨. 고아 리소스 GC 미구현

#### 6. 세션 포크/스냅샷 (Session Fork & Snapshot)
- **개념**: 에이전트 세션을 임의 시점에 스냅샷하고, 스냅샷에서 새 세션을 포크(Fork)하여 병렬 실험 가능. Git의 branch 개념을 에이전트 세션에 적용
- **Orbit 대응**: `AgentSession` 모델에 `parentId` + `snapshotAt` 필드 추가. `SessionManager.fork(sessionId)` 메서드. `/compare` 페이지에 포크 세션 A/B 비교 통합
- **현재 상태**: A/B Compare 페이지 구현됨. 세션 포크 프리미티브 미구현

---

## 영향

### 즉각 변경 없음
이 ADR은 방향 결정이다. 각 패턴은 독립적으로 구현 가능하며, Phase 1-4 기존 코드와 하위 호환된다.

### 향후 구현 시 영향 범위

| 패턴 | 영향 파일 | 예상 규모 |
|------|----------|---------|
| 아키텍처 강제 | `.eslintrc.json`, 각 레이어 `index.ts` | 소 |
| 컨텍스트 엔지니어링 | `src/server/AGENTS.md`, `src/components/AGENTS.md` 등 신규 | 소 |
| 옵저버빌리티 | `src/server/graph/traceDetector.ts`, `prisma/schema.prisma`, Socket handler | 중 |
| Golden Paths | `src/server/pty/interceptor.ts`, `src/server/pty/interceptorRules.ts`, `/api/interceptor/rules` | 중 |
| GC 에이전트 | `src/server/session/sessionManager.ts`, `src/server/ssh/sshManager.ts` | 소-중 |
| 세션 포크 | `prisma/schema.prisma`, `src/server/session/sessionManager.ts`, `src/app/compare/` | 중 |

---

## 관련 노트
- 선행: [Phase 2-4 병렬 구현](../features/2026-02-28_phase2-4-parallel.md) — CommandInterceptor, TraceDetector, DeltaStream, ABCompare 기초 구현
- 선행: [Phase 1 인프라](../features/2026-02-27_phase1-infra.md) — PTY, SessionManager, Socket.io 기반 구조
- 관련: [스킬 전략 ADR](2026-02-27_skill-strategy.md) — `/phase`, `/link-notes`, `/dep-install` 스킬 전략
