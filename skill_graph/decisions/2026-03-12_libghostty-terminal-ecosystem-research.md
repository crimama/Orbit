# libghostty & 차세대 터미널 에코시스템 리서치 -- 2026-03-12

> **분류**: 기술 선택 / 리서치
> **keywords**: `libghostty` `ghostty-web` `restty` `xterm.js` `terminal` `WebGPU` `WASM` `session-persistence` `agent-orchestration` `zmx` `mux`

---

## 맥락

Agent-Orbit은 xterm.js + WebGL + node-pty 기반 터미널 스택을 사용 중이다.
libghostty 에코시스템이 빠르게 성장하면서 xterm.js 대체재 및 보완 기술이 등장했다.
현재 스택의 한계 (복잡 스크립트 렌더링, 세션 상태 복원, 멀티에이전트 병렬화)를 해결할 수 있는 기술을 조사한다.

**소스**: [awesome-libghostty](https://github.com/Uzaaft/awesome-libghostty)

---

## 핵심 기술 분석

### 1. libghostty-vt (코어 파서)

- **URL**: https://libghostty.tip.ghostty.org/
- **개요**: Ghostty 터미널에서 추출한 C 라이브러리. VT100 상태 머신, 이스케이프 시퀀스 파싱, 터미널 상태 관리
- **특징**:
  - Zero dependency (libc도 불필요)
  - SIMD 최적화 파싱 + fuzzing 검증
  - Kitty Graphics Protocol, Tmux Control Mode 지원
  - WASM 빌드 지원 (브라우저 임베딩 가능)
  - Scrollback 관리, 라인 리플로우 내장
- **상태**: Public alpha, API 불안정 (6개월 내 안정화 목표)
- **Orbit 관련성**: 🟡 장기적 xterm.js 파서 대체 후보. 현재는 API 불안정으로 당장 채택 어려움

### 2. ghostty-web (xterm.js 대체)

- **URL**: https://github.com/coder/ghostty-web
- **개요**: WASM 컴파일된 Ghostty 파서를 브라우저에서 실행. xterm.js API 호환
- **핵심**:
  - `npm install ghostty-web` → `@xterm/xterm` 드롭인 교체 가능
  - 99.2% TypeScript
  - ~400KB 번들 (zero runtime deps)
  - 복잡 스크립트(Devanagari, Arabic) 렌더링 정확도 xterm.js 대비 우수
  - XTPUSHSGR/XTPOPSGR 지원 (xterm.js 미지원)
- **한계**: 렌더링 계층 미상세 (Canvas/WebGL/WebGPU 여부 불명확)
- **Orbit 관련성**: 🟢 **가장 유력한 xterm.js 대체재**. API 호환으로 마이그레이션 비용 낮음

### 3. Restty (WebGPU 터미널)

- **URL**: https://github.com/wiedymi/restty
- **개요**: WebGPU + libghostty-vt 기반 고성능 웹 터미널
- **핵심**:
  - WebGPU 렌더링 (WebGL2 폴백)
  - 내장 멀티페인 관리 (vertical/horizontal split)
  - 플러그인 아키텍처 (input interceptor, lifecycle hook, shader stage)
  - 테마 시스템 + 커스텀 WGSL/GLSL 셰이더
  - xterm.js 호환 레이어 (`restty/xterm`)
  - 터치 핸들링 (모바일 지원)
- **한계**: Early release, kitty image protocol 엣지케이스
- **Orbit 관련성**: 🟡 WebGPU 렌더링 + 내장 멀티페인은 매력적이나 성숙도 부족. 플러그인 아키텍처 패턴은 참고 가치 있음

### 4. ZMX (세션 퍼시스턴스)

- **URL**: https://github.com/neurosnap/zmx
- **개요**: 터미널 프로세스 세션 퍼시스턴스. tmux에서 윈도우 관리를 제거한 경량 대안
- **핵심 아키텍처**:
  - 데몬-클라이언트 모델 (Unix 소켓 통신)
  - PTY 프로세스를 서버가 관리, 클라이언트 disconnection에도 유지
  - 스크롤백 히스토리 보존 + 터미널 상태 복원
  - SSH 워크플로우 통합: `.ssh/config`에 `RemoteCommand zmx attach %k` 설정
  - `zmx history <name>` — 플레인텍스트/VT escape/HTML 형식 히스토리 출력
- **철학**: "smol tools" — 하나의 문제만 잘 풀기. OS 윈도우 매니저와 중복 기능 제거
- **Orbit 관련성**: 🟢 **세션 퍼시스턴스 패턴 직접 참고 가능**. 특히 SSH RemoteCommand 통합 패턴과 소켓 기반 attach/detach 모델

---

## 경쟁/유사 프로젝트 분석

### 5. Mux (Coder) — 에이전트 병렬 개발

- **URL**: https://github.com/coder/mux
- **개요**: 데스크탑+브라우저 앱. 다수 AI 에이전트 병렬 실행, git divergence 추적
- **기술 스택**: TypeScript 97.5%, Vite, Jest, Playwright, Bun
- **핵심 패턴**:
  - **3종 격리 모델**: Local → Git Worktree → SSH Remote
  - **중앙 집중 git divergence 추적**: 병렬 워크스페이스 간 변경/충돌 시각화
  - **멀티모델 지원**: Anthropic, OpenAI, xAI, Ollama, OpenRouter
  - Plan/Exec 모드, Vim 키바인딩, `/compact` 컨텍스트 관리
  - 코스트/토큰 소비 추적
- **Orbit과 비교**:
  - Orbit: 웹 기반, Socket.io, 원격 SSH 특화, 인터셉터/가드레일
  - Mux: Electron+웹, ghostty-web, 로컬 특화, git divergence 시각화
  - **Orbit 차별점**: 하네스 레이어(가드레일, 인터셉터), 모바일 PWA, 스킬 그래프

### 6. Webterm — 웹 터미널 대시보드

- **URL**: https://github.com/rcarmo/webterm
- **개요**: Go 기반 HTTP/WebSocket 서버. 대시보드 모드에서 라이브 터미널 타일 표시
- **핵심 패턴**:
  - **스크린샷 시스템**: `go-te` 라이브러리로 터미널 상태의 PNG/SVG 썸네일 생성 → 대시보드 타일
  - **SSE 활성도 업데이트**: 폴링 없이 실시간 대시보드 갱신
  - **Docker Watch 모드**: 컨테이너 라벨 기반 자동 세션 관리
  - **매니페스트 기반 설정**: YAML로 command + theme 쌍 정의
- **Orbit 관련성**: 🟡 대시보드 타일 + SSE 패턴은 세션 모니터링 UX 개선에 참고. 특히 터미널 썸네일 프리뷰 아이디어

### 7. 기타 주목할 프로젝트

| 프로젝트 | 핵심 | Orbit 참고 |
|----------|------|-----------|
| **Supacode** | Swift 네이티브 macOS 에이전트 커맨드센터 | Composable Architecture 패턴 |
| **cmux** | macOS 터미널 + AI 에이전트 알림 시스템 | 에이전트 알림/노티피케이션 UX |
| **Commander** | AI 워크스페이스 + diff 리뷰 + worktree | Diff 리뷰 워크플로우 |
| **Ghostree** | Ghostty + git worktree + AI agents | Worktree 네이티브 통합 |
| **fantastty** | 세션 워크스페이스 + 노트 + 탭 프리뷰 | 세션 워크스페이스 + 라이브 프리뷰 |
| **Trolley** | 크로스플랫폼 TUI 앱 배포 런타임 | TUI 앱 런타임 배포 모델 |

---

## Orbit 적용 전략

### 단기 (현재 적용 가능)

1. **세션 퍼시스턴스 강화** — ZMX 패턴 참고
   - SSH `RemoteCommand` 통합으로 원격 세션 자동 attach
   - 소켓 기반 attach/detach 모델을 Socket.io 핸들러에 적용

2. **터미널 썸네일 프리뷰** — Webterm 패턴 참고
   - 대시보드 세션 카드에 터미널 상태 스크린샷/ASCII 프리뷰 표시
   - SSE 기반 활성도 갱신

3. **에이전트 알림 시스템** — cmux 참고
   - 에이전트 작업 완료/에러 시 브라우저 알림 + 대시보드 배지

### 중기 (3-6개월)

4. **ghostty-web 마이그레이션 평가**
   - xterm.js → ghostty-web 드롭인 교체 테스트
   - 복잡 스크립트 렌더링 + XTPUSHSGR 지원 이점
   - 번들 사이즈 비교 (xterm.js+addons vs ghostty-web 400KB)
   - 고려사항: WebGL addon 호환성, FitAddon 대체, 커스텀 키 핸들링

5. **git divergence 시각화** — Mux 패턴 참고
   - 멀티에이전트 워크트리 간 변경 충돌 시각화
   - 현재 `.locks/` 파일 잠금 + React Flow 그래프에 통합

### 장기 (6개월+)

6. **Restty WebGPU 전환 모니터링**
   - WebGPU 브라우저 지원이 안정화되면 재평가
   - 플러그인 아키텍처 (interceptor hook, shader stage) 패턴 참고

7. **libghostty-vt 직접 사용**
   - C API 안정화 후 node-pty + libghostty-vt 결합 평가
   - WASM 빌드로 클라이언트 사이드 VT 파싱 가능 (오프라인 스크롤백)

---

## 결정

**현재**: xterm.js + WebGL + node-pty 스택 유지. 안정적이고 검증됨.
**모니터링**: ghostty-web의 API 안정화 및 커뮤니티 성장 추적.
**패턴 차용**: ZMX(세션 퍼시스턴스), Webterm(대시보드 프리뷰), Mux(git divergence).

---

## 관련 노트

- 선행: [Phase 1 인프라](../features/2026-02-27_phase1-infra.md) — xterm.js + node-pty 기반 구축
- 선행: [Phase 2-4 병렬](../features/2026-02-28_phase2-4-parallel.md) — SSH + RemotePty
- 관련: [하네스 엔지니어링 ADR](2026-02-28_harness-engineering.md) — 인터셉터/가드레일
