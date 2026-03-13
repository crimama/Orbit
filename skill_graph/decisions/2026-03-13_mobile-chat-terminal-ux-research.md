# 모바일 채팅/터미널 UI/UX 인사이트 리서치 — 2026-03-13

> **상태**: 🟢 완료
> **카테고리**: decision/research
> **keywords**: mobile-ux chat-ui chatbot terminal-mobile thumb-zone virtual-keyboard streaming-markdown skeleton-screen PWA push-notification offline-first xterm-mobile gesture viewport OLED

---

## 요약

모바일 환경에서의 **채팅/챗봇 인터페이스**와 **터미널 프로그램** UI/UX 인사이트를 종합 수집.
3개 영역(채팅 UX, 터미널 UX, PWA 패턴)을 병렬 리서치하여 Orbit 모바일 구현에 적용 가능한 패턴을 정리.

---

## Part 1: 모바일 채팅/챗봇 UI/UX

### 1.1 주요 메시징 앱 디자인 패턴

| 앱 | 핵심 패턴 | Orbit 적용점 |
|---|---------|------------|
| **WhatsApp** | 베이지 배경, 녹색 발신 버블, Reply-to 컨텍스트 유지 | 메시지 버블 색상 구분, 오디오 피드백 |
| **Telegram** | 최고 수준 커스터마이징(테마, 레이아웃) | 테마 커스터마이징 옵션 |
| **Signal** | 프라이버시 중심 미니멀 UI, 체크마크 읽음 확인 | 최소한의 크롬, 심플 상태 표시 |
| **Discord Mobile** | 스레딩으로 중첩 대화 관리 | 세션별 대화 스레딩 |
| **Slack Mobile** | 타이핑 인디케이터, 스레딩, 앱 통합 | 타이핑 인디케이터, 워크플로우 통합 |

### 1.2 AI 챗봇 모바일 UX 핵심 원칙

1. **임베디드 인텔리전스** — AI는 워크플로우에 통합, 레이어 위에 얹지 않음
2. **환영 메시지 간결화** — 긴 웰컴 메시지는 압도적; 간결하게 유지
3. **프롬프트 제안** — 빠른 액션 카드로 일반적 쿼리 유도
4. **스트리밍 응답** — 캐릭터 단위 생성 시각화 (신뢰 구축)
5. **음성 입력 통합** — 타이핑/음성 빠른 전환

### 1.3 Thumb Zone 최적화

- 49% 사용자가 한 손으로 폰 조작, 75% 인터랙션이 엄지 기반
- 최소 탭 타겟: **48x48px** (Material Design)
- 주요 액션(전송, 첨부)은 반드시 화면 하단 배치
- Green Zone(하단) = 주요 액션, Red Zone(상단) = 핵심 UI 배치 금지

### 1.4 스트리밍 마크다운 렌더링

**문제**: AI 스트리밍 응답 시 불완전한 마크다운 청크 도착

**솔루션**: FluidMarkdown (Ant Group), Streamdown (React), Memoized Markdown (Vercel AI SDK)

코드 블록 모바일: 600px 미만 폰트 축소+수평스크롤, GPU 가속

### 1.5 메시지 가상화 (Virtualized List)

- **필수**: 100개 이상 메시지에서 비협상 사항
- 20-50개만 렌더, Overscan 5-10개
- react-window, react-virtualized, Intersection Observer

### 1.6 마이크로인터랙션 & 햅틱

- 메시지 전송: 미묘한 진동 확인
- 새 메시지 도착: 부드러운 펄스
- 타이핑 인디케이터: 세 점 애니메이션
- 버블 등장: 확대/스프링 효과

### 1.7 스켈레톤 스크린

- 체감 로딩 시간 **30% 감소**, 10초 미만 로드에 사용, 시머 애니메이션 추가

---

## Part 2: 모바일 터미널 UI/UX

### 2.1 주요 터미널 앱 분석

| 앱 | 플랫폼 | 핵심 패턴 |
|---|-------|---------|
| **Termux** | Android | 커스텀 extra keys 행, 토글 추가 키패드 |
| **Termius** | iOS/Android | 제스처 우선: 스와이프=화살표, 더블탭=Tab |
| **Blink Shell** | iOS | Hterm 렌더링, Mosh 통합 |
| **Prompt by Panic** | iOS | 완전 커스텀 온스크린 키보드 |
| **iSH** | iOS | Alpine Linux 로컬 샌드박스 |

### 2.2 3-Tier 키보드 아키텍처 (권장)

**Tier 1**: 네이티브 키보드 (예측 텍스트 간섭 처리)
**Tier 2**: Extra Keys 행 (Esc, Tab, Ctrl, Alt, 화살표, 특수문자)
**Tier 3**: 제스처 레이어 (Space+스와이프, 더블탭, 투핑거)

### 2.3 화면 영역 최적화

- 세로 폰: 터미널 90-95%, 키보드 5-10%
- 가로 폰: 터미널 70-85%, 키보드 15-30%
- 태블릿: 사이드바 + 터미널 나란히

### 2.4 xterm.js 모바일 이슈

| 이슈 | GitHub # | 해결책 |
|------|---------|-------|
| 터치 지원 부족 | #5377 | TouchHandlingService 구현 |
| iPad 복사/붙여넣기 | #3727 | 커스텀 선택 UI 오버레이 |
| 예측 키보드 간섭 | #2403 | VirtualKeyboard API manual 정책 |
| Smart Keyboard | #1101 | document.body 포커스 강제 |
| 넓은 컨테이너 | #4175 | WebGL 렌더러 사용 |

### 2.5 터치 인터랙션

- Text Pin 기법 (탭 시작/끝점) — 핸들 드래그 대비 **23% 빠름**
- 핀치-투-줌 폰트, 투핑거 스크롤

### 2.6 렌더링

WebGL 기본 + Canvas 폴백 (GPU 컨텍스트 손실 대비)

---

## Part 3: 모바일 PWA UX 패턴

### 3.1 Fullscreen PWA

display standalone (78% 채택률), 커스텀 뒤로가기 필수

### 3.2 iOS Safari 뷰포트

100dvh 사용 (100vh 대체), keyboard-inset-height, safe-area-inset-*

### 3.3 오프라인-퍼스트 캐싱

| 전략 | 용도 |
|------|------|
| Cache-First | 정적 자산, 앱 셸 |
| Network-First | 채팅, 실시간 데이터 |
| Stale-While-Revalidate | API, 터미널 히스토리 |

IndexedDB로 채팅+터미널 저장, Background Sync API로 메시지 큐잉

### 3.4 WebSocket 배터리 최적화

Page Visibility API disconnect (31% 절약), 핑 간격 120초, 200ms 배치 (50% 절약)

### 3.5 푸시 알림

채팅 메시지(높음), 연결 끊김(높음), 터미널 출력(중간), 세션 준비(낮음)
규칙: 첫 로드 요청 금지, 일 1건 초과 금지

### 3.6 다크 모드 & OLED

순수 블랙 #000000 = OLED 40-50% 전력 절약

### 3.7 하이브리드 레이아웃

데스크탑 >600px: 스플릿, 태블릿: 탭, 모바일 <400px: 바텀 시트
바텀 네비게이션 + 스와이프 동시 사용 금지

---

## Orbit 적용 우선순위

### P0 필수
- 메시지 리스트 가상화 (react-window)
- 스트리밍 마크다운 렌더러
- 100dvh 뷰포트 전체 적용
- WebGL + GPU 컨텍스트 손실 처리

### P1 높음
- 48px 탭 타겟 전수 검증
- xterm 커스텀 터치 레이어
- Page Visibility 소켓 관리
- Optimistic UI (채팅)
- 스켈레톤 스크린

### P2 중간
- Termius 스타일 제스처
- IndexedDB 오프라인 캐싱
- Background Sync 메시지 큐
- 푸시 알림, 햅틱 피드백

### P3 폴리시
- OLED 순수 블랙 모드
- iOS 설치 프롬프트
- 적응형 핑 간격 (120초)
- 음성 입력 통합

---

## 출처

채팅: CometChat, GetStream, Sendbird, Smashing Magazine (Thumb Zone), NNGroup (Skeleton), FluidMarkdown, Streamdown
터미널: Termius Blog, Termux GitHub, xterm.js #5377/#3727/#2403/#1101/#4175, Blink Shell, Prompt by Panic
PWA: HTTP Archive PWA Almanac 2025, MDN VirtualKeyboard API, Material Design 3, MagicBell Push

---

## 관련 노트
- 선행: [Happy 모바일+YOLO 리서치](2026-03-12_happy-mobile-yolo-research.md)
- 선행: [터미널 에코시스템 리서치](2026-03-12_libghostty-terminal-ecosystem-research.md)
- 선행: [프론트엔드 상세명세서](../features/2026-03-12_frontend-component-specification.md)
- 선행: [모바일 command send 미실행](../bugfix/2026-03-12_mobile-command-send-execution.md)
- 후속: 모바일 채팅 UI 구현, 터미널 터치 레이어 구현, PWA 오프라인 전략 구현
