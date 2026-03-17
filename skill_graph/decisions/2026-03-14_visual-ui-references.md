# Visual UI References: Master Design Reference

**날짜**: 2026-03-14
**카테고리**: decisions/research
**상태**: 완료

---

## 개요

Agent-Orbit의 시각적 품질을 프리미엄 대시보드 수준으로 끌어올리기 위한 종합 레퍼런스.
Terminal UI, Dashboard UI, Chat/Mobile UI 리서치를 통합하여 실행 가능한 패턴으로 정리.

---

## 1. Design Token Recommendations

### 1.1 Color System

#### Primary Dark Palette (Catppuccin Mocha - Terminal용)

```css
:root[data-theme="catppuccin-mocha"] {
  /* === BACKGROUNDS === */
  --color-bg-primary:    #1e1e2e;   /* Mocha base — 터미널 메인 bg */
  --color-bg-secondary:  #313244;   /* surface0 — 패널, 카드 */
  --color-bg-tertiary:   #45475a;   /* surface1 — hover, divider */

  /* === TEXT === */
  --color-text-primary:   #cdd6f4;  /* text — 본문 */
  --color-text-secondary: #bac2de;  /* subtext0 — 보조 텍스트 */
  --color-text-muted:     #a6adc8;  /* subtext1 — 플레이스홀더 */

  /* === ACCENTS === */
  --color-accent-primary:   #89b4fa;  /* blue — 포커스, 활성 */
  --color-accent-secondary: #94e2d5;  /* teal — 보조 액센트 */
  --color-accent-success:   #a6e3a1;  /* green — 성공 */
  --color-accent-warning:   #f9e2af;  /* yellow — 경고 */
  --color-accent-error:     #f38ba8;  /* red — 에러 */
  --color-accent-info:      #89dceb;  /* sky — 정보 */

  /* === BORDERS === */
  --color-border-primary:   #45475a;  /* surface1 — 기본 */
  --color-border-secondary: #313244;  /* 미묘한 구분 */
  --color-border-focus:     #89b4fa;  /* blue — 포커스 링 */

  /* === TERMINAL ANSI === */
  --ansi-black:   #45475a;  --ansi-bright-black:   #585b70;
  --ansi-red:     #f38ba8;  --ansi-bright-red:     #f38ba8;
  --ansi-green:   #a6e3a1;  --ansi-bright-green:   #a6e3a1;
  --ansi-yellow:  #f9e2af;  --ansi-bright-yellow:  #f9e2af;
  --ansi-blue:    #89b4fa;  --ansi-bright-blue:    #89b4fa;
  --ansi-magenta: #f5c2e7;  --ansi-bright-magenta: #f5c2e7;
  --ansi-cyan:    #94e2d5;  --ansi-bright-cyan:    #94e2d5;
  --ansi-white:   #bac2de;  --ansi-bright-white:   #cdd6f4;
}
```

#### Dashboard Dark Palette (Slate-based — 대시보드용)

```css
:root {
  /* === BACKGROUNDS === */
  --bg-primary:   #0f172a;   /* slate-950 — 페이지 bg */
  --bg-secondary: #1e293b;   /* slate-800 — 카드, 패널 */
  --bg-tertiary:  #334155;   /* slate-700 — 호버, 구분선 */
  --bg-input:     #1a1f35;   /* custom — 입력, 코드 영역 */

  /* === TEXT === */
  --text-primary:   #f1f5f9; /* slate-100 */
  --text-secondary: #cbd5e1; /* slate-300 */
  --text-muted:     #94a3b8; /* slate-400 */
  --text-code:      #e2e8f0; /* slate-200 — 모노스페이스 */

  /* === BORDERS === */
  --border-subtle:  #334155; /* slate-700 */
  --border-default: #475569; /* slate-600 */
  --border-focus:   #3b82f6; /* blue-500 */

  /* === STATUS === */
  --status-connected:  #10b981; /* emerald-500 */
  --status-connecting: #f59e0b; /* amber-500 */
  --status-error:      #ef4444; /* red-500 */
  --status-idle:       #6b7280; /* gray-500 */

  /* === ACCENTS === */
  --accent-primary:   #3b82f6; /* blue-500 — CTA, 하이라이트 */
  --accent-secondary: #8b5cf6; /* violet-500 — 보조 */
  --accent-danger:    #dc2626; /* red-600 — 파괴적 액션 */
}
```

#### OLED 최적화

```
OLED 기기: bg-primary → #000000 (픽셀 OFF = 배터리 절약)
비-OLED:   bg-primary → #0f172a (slate-950, 순수 검정 방지)
피할 것: 네온 컬러(#FF00FF) — 다크 bg에서 진동 효과 유발
텍스트: 순수 흰색(#fff) 대신 slate-100(#f1f5f9) 권장
```

### 1.2 Spacing Scale (4px 기반)

```css
--space-1:  4px;   /* 미세 간격 */
--space-2:  8px;   /* 컴팩트 */
--space-3:  12px;
--space-4:  16px;  /* 기본 */
--space-6:  24px;  /* 섹션 내 */
--space-8:  32px;  /* 섹션 간 */
--space-10: 40px;
--space-12: 48px;
```

### 1.3 Border Radius

```css
--radius-sm:   4px;     /* 입력, 소형 버튼 */
--radius-md:   8px;     /* 카드, 모달 */
--radius-lg:   12px;    /* 대형 컴포넌트 */
--radius-full: 9999px;  /* 상태 도트, 뱃지 */
```

### 1.4 Shadow System

```css
--shadow-sm: 0 1px 2px 0 rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1);
--shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1);
--shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1);

/* Discord 레이어드 엘리베이션 패턴 */
--elevation-0: none;               /* 기본면 */
--elevation-1: var(--shadow-sm);   /* 카드 */
--elevation-2: var(--shadow-md);   /* 드롭다운 */
--elevation-3: var(--shadow-lg);   /* 모달 */
--elevation-4: var(--shadow-xl);   /* 최상단 오버레이 */
```

### 1.5 Z-Index Scale

```css
--z-dropdown: 100;
--z-sticky:   200;
--z-fixed:    300;
--z-backdrop: 400;
--z-modal:    500;
--z-toast:    600;
--z-tooltip:  700;
```

### 1.6 Typography

```css
--font-mono: 'JetBrains Mono', 'Menlo', monospace;
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* 터미널 */
--font-size-terminal: 13px;
--line-height-terminal: 1.2;

/* UI 텍스트 스케일 */
--text-xs:   12px / 1.4;
--text-sm:   14px / 1.5;
--text-base: 16px / 1.6;
--text-lg:   18px / 1.6;
--text-xl:   20px / 1.5;

/* Transition */
--transition-fast:   100ms ease-out;
--transition-normal: 200ms ease-out;
--transition-slow:   300ms ease-out;
```

---

## 2. Component Patterns

### 2.1 Status Indicator (Vercel 대시보드 패턴)

```tsx
type Status = 'connected' | 'connecting' | 'error' | 'idle';

export function StatusDot({ status }: { status: Status }) {
  return (
    <div
      className={[
        'w-2 h-2 rounded-full',
        status === 'connected'  && 'bg-emerald-500 animate-pulse',
        status === 'connecting' && 'bg-amber-500 animate-pulse',
        status === 'error'      && 'bg-red-500',
        status === 'idle'       && 'bg-gray-500',
      ].filter(Boolean).join(' ')}
      title={status}
    />
  );
}
```

**레퍼런스**: Vercel Dashboard — 8px 도트, 활성 상태에서 pulse 애니메이션

### 2.2 Session Card (Vercel + Linear 혼합 패턴)

```tsx
export function SessionCard({ session }: { session: Session }) {
  return (
    <div className="p-4 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors duration-100 cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusDot status={session.status} />
          <h3 className="text-sm font-semibold text-slate-100">{session.name}</h3>
        </div>
        <span className="text-xs text-slate-400">{formatRelativeTime(session.lastActivity)}</span>
      </div>
      <div className="text-xs text-slate-400 mb-2">
        Agent: <span className="text-slate-300">{session.agentName}</span>
      </div>
      <div className="flex gap-4 text-xs text-slate-400">
        <span>CPU: {session.cpuUsage}%</span>
        <span>Memory: {session.memory}</span>
      </div>
    </div>
  );
}
```

**레퍼런스**: Vercel 카드 호버(100ms transition) + Linear 인플레이스 편집 패턴

### 2.3 Empty State

```tsx
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-4xl mb-4 opacity-40">{icon}</div>
      <h3 className="text-sm font-semibold text-slate-200 mb-2">{title}</h3>
      <p className="text-sm text-slate-400 mb-6 max-w-xs">{description}</p>
      {action && (
        <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-500 transition-colors">
          {action.label}
        </button>
      )}
    </div>
  );
}
```

**적용 위치**: ProjectList, SessionList, TerminalPane (현재 누락)

### 2.4 Skeleton Screen (Grafana/LangSmith 패턴)

```css
@keyframes shimmer {
  0%   { background-position: -1000px 0; }
  100% { background-position:  1000px 0; }
}

.skeleton {
  background: linear-gradient(90deg, #1e293b 0%, #334155 50%, #1e293b 100%);
  background-size: 1000px 100%;
  animation: shimmer 2s infinite;
  border-radius: var(--radius-sm);
}
```

**적용 위치**: 세션 카드 로딩, 터미널 첫 데이터 전, 에이전트 메트릭

### 2.5 Toast Notifications (Sonner 패턴)

```
위치: 데스크탑 → bottom-right / 모바일 → bottom-center (safe area)
기간: 성공 3s | 정보 3s | 경고 5s | 에러 persistent (수동 해제)

예시:
  ✓ Session resumed           (emerald, 3s)
  ✗ Connection lost           (red, persistent)
  ! Agent timeout in 30s      (amber, 5s + action)
  → Command copied            (gray, 1.5s)
```

```css
@keyframes toastSlideIn {
  from { transform: translateY(100%); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
.toast { animation: toastSlideIn 150ms ease-out forwards; }
```

### 2.6 Progress Indicators

```
1. 퍼센트 바 (진행량 알 때):
   ████████░░░░░░░░  45%  —  7/23 파일 업로드

2. 인디케이터 스피너 (시간 미확정):
   ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏  120ms 간격
   문자셋: braille > single-char(|-\/) > unicode boxes

3. 스텝 인디케이터 (다단계):
   ✓ 환경 복원  →  ✓ 히스토리 로드  →  ⟳ 실행 재개...
```

### 2.7 Command Palette (Linear ⌘K 패턴)

```
트리거: ⌘K (전역)
기능:
  - 세션 생성 (⌘N)
  - 세션 재개 (R)
  - SSH 연결 전환 (⌘⇧K)
  - 퍼지 검색
  - 최근 사용 명령
  - 단축키 목록

UI: 중앙 모달, 배경 backdrop blur,
    입력창 상단 고정, 결과 스크롤
```

### 2.8 xterm.js 테마 설정

```typescript
import { Terminal } from '@xterm/xterm';

const terminal = new Terminal({
  theme: {
    background:    '#1e1e2e',
    foreground:    '#cdd6f4',
    cursor:        '#f5e0dc',
    cursorAccent:  '#1e1e2e',
    selection:     'rgba(204,204,204,0.3)',
    black:         '#45475a', brightBlack:   '#585b70',
    red:           '#f38ba8', brightRed:     '#f38ba8',
    green:         '#a6e3a1', brightGreen:   '#a6e3a1',
    yellow:        '#f9e2af', brightYellow:  '#f9e2af',
    blue:          '#89b4fa', brightBlue:    '#89b4fa',
    magenta:       '#f5c2e7', brightMagenta: '#f5c2e7',
    cyan:          '#94e2d5', brightCyan:    '#94e2d5',
    white:         '#bac2de', brightWhite:   '#cdd6f4',
  },
  fontFamily: "'JetBrains Mono', 'Menlo', monospace",
  fontSize:   13,
  lineHeight: 1.2,
  cursorBlink: true,
});
```

---

## 3. Animation Patterns

### 3.1 Motion Library 원칙

**Framer Motion** 사용 권장 (GPU 가속, Spring 물리):

```typescript
// 카드 호버 리프트
<motion.div whileHover={{ y: -2, boxShadow: 'var(--shadow-lg)' }} transition={{ duration: 0.1 }} />

// 모달 진입
<AnimatePresence>
  {open && (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
    />
  )}
</AnimatePresence>

// 리스트 아이템 순서 진입
<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} />
```

**반드시 준수**: `prefers-reduced-motion` 미디어 쿼리 존중

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 3.2 Streaming UI 패턴 (ChatGPT/Claude 스타일)

```typescript
// 스트리밍 텍스트 커서
.streaming-cursor::after {
  content: '▋';
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

// 청크 단위 진입
const [displayText, setDisplayText] = useState('');
useEffect(() => {
  if (chunk) setDisplayText(prev => prev + chunk);
}, [chunk]);
```

### 3.3 상태 전환 애니메이션 속도 가이드

| 상황 | 시간 | 근거 |
|------|------|------|
| 버튼 hover/press | 100ms | 즉각적 피드백 |
| 카드 hover | 100ms | 반응성 |
| 모달 진입/퇴장 | 150-200ms | 방향 인식 |
| 페이지 전환 | 200-300ms | 컨텍스트 이해 |
| 리스트 항목 순서 | 50ms/item | 연쇄 효과 |
| 토스트 진입 | 150ms | 주목 집중 |

### 3.4 Micro-interactions

- **카드 호버**: 100ms, `bg-slate-700` + 미세 shadow lift
- **버튼 press**: `scale(0.97)`, 100ms
- **입력 포커스**: border-color → `--border-focus`, 100ms
- **스피너**: braille 문자, 120ms 간격
- **상태 도트**: pulse 애니메이션 (connected/connecting만)
- **Bottom sheet (모바일)**: `translateY` 슬라이드, spring 물리

---

## 4. Orbit Gap Analysis — 우선순위 매트릭스

### HIGH PRIORITY (즉시 수정)

| 문제 | 위치 | 영향 | 해결책 |
|------|------|------|--------|
| 인라인 스타일 & 하드코딩 컬러 | ProjectList.tsx, TerminalPane.tsx, SessionList.tsx | 테마 시스템 불가 | CSS 변수 + Tailwind 클래스로 전환 |
| Border/Shadow 시스템 누락 | 전역 | 시각적 깊이 없음 | `--shadow-*`, `--border-*` 토큰 도입 |
| Empty state 누락 | ProjectList, SessionList, TerminalPane | 빈 화면 노출 시 UX 단절 | EmptyState 컴포넌트 추가 |
| 폼 입력 focus 불일치 | 전체 | blue-500 vs sky-500 vs neutral-500 혼재 | `--border-focus: #3b82f6` 단일화 |
| Hover/Active/Focus 상태 JS 구동 | 다수 | CSS transition 없음, 퍼포먼스 저하 | CSS-first hover/focus 구현 |

### MEDIUM PRIORITY (1-2주 내)

| 문제 | 위치 | 영향 | 해결책 |
|------|------|------|--------|
| 상태 뱃지 opacity/animation 불일치 | SessionList | 상태 구분 모호 | StatusDot 컴포넌트 표준화 + pulse |
| 버튼 크기 체계 없음 | 전체 | 시각적 일관성 부재 | sm/md/lg 사이즈 스케일 정의 |
| 컬러 피커 키보드 네비게이션 누락 | 프로젝트 설정 | 접근성 | Radix UI ColorPicker로 대체 |
| 인터셉터 모달 카운트다운 바 없음 | InterceptorModal | 승인 대기 중 진행 상황 불명 | 진행 바 + 남은 시간 표시 |
| 가상 키보드 햅틱 피드백 힌트 없음 | 모바일 VirtualKeyboard | 터치 피드백 부재 | active scale 애니메이션 |

### LOW PRIORITY (백로그)

| 문제 | 위치 | 해결책 |
|------|------|--------|
| CSS 변수 시스템 불완전 | globals.css | color-scale, spacing, shadow, z-index 전체 토큰화 |
| 타이포그래피 계층 불일치 | 전체 | text-[10px]/text-xs/text-sm 점프 → 스케일 정의 후 준수 |

---

## 5. 레이아웃 아키텍처

### 데스크탑 권장 레이아웃

```
┌──────────────────────────────────────────────────────┐
│ Header (56px): Logo | Breadcrumb | Search | UserMenu │
├─────────────┬────────────────────────────────────────┤
│ Sidebar     │ Main Content                           │
│ (224px)     │                                        │
│             │  Tabs/Breadcrumb                       │
│ [Projects]  │  ┌─ Session Card ─────────────────┐   │
│  ├─ A       │  │ ● Connected  •  claude-code    │   │
│  ├─ B       │  │ CPU: 42%  MEM: 1.2G  •  2m ago │   │
│             │  └────────────────────────────────┘   │
│ [Sessions]  │  ┌─ Session Card ─────────────────┐   │
│  Running(3) │  │ ⟳ Connecting  •  codex-remote  │   │
│  Paused(1)  │  └────────────────────────────────┘   │
│             │                                        │
│ [Settings]  │                                        │
└─────────────┴────────────────────────────────────────┘
Toast (bottom-right)
```

### 반응형 브레이크포인트

```
Desktop (>1024px): Sidebar 224px 상시 표시
Tablet (768-1024): Sidebar 접기 가능 (toggle)
Mobile (<768px):   Sidebar → Drawer (swipe-to-reveal)
                   카드 전체 폭 스택, 토스트 → bottom-center safe area
```

---

## 6. 레퍼런스 출처

| 플랫폼 | 채택 패턴 |
|--------|-----------|
| **Warp Terminal** | 종합 테마 시스템, 액센트 컬러 단일 속성 |
| **Wave Terminal** | 블록 기반 레이아웃, 다중 컨텐츠 타입 |
| **Catppuccin** | ANSI 16-color 팔레트, WCAG AAA 준수 |
| **Vercel Dashboard** | Status Dot, SWR 패턴, Card 레이아웃, 페비콘 상태 |
| **Grafana** | 실시간 메트릭 위젯, 시계열 시각화 |
| **LangSmith** | Execution DAG, Trace Timeline, 코스트 표시 |
| **Linear** | ⌘K 팔레트, 키보드-퍼스트, Optimistic UI |
| **ChatGPT/Claude** | 스트리밍 마크다운, 커서 애니메이션 |
| **Discord** | 레이어드 엘리베이션 시스템 |
| **Framer Motion** | Spring 물리 기반 애니메이션, `reduced-motion` 지원 |

---

## 관련 노트

- [모바일 채팅/터미널 UX 리서치](./2026-03-13_mobile-chat-terminal-ux-research.md) — Thumb Zone, xterm 모바일 이슈
- [터미널 에코시스템 리서치](./2026-03-12_libghostty-terminal-ecosystem-research.md) — xterm.js 대체재 평가
- [Happy 모바일+YOLO 리서치](./2026-03-12_happy-mobile-yolo-research.md) — OLED, 퍼미션 패턴
- [프론트엔드 상세명세서](../features/2026-03-12_frontend-component-specification.md) — 컴포넌트 Props/State 구조
