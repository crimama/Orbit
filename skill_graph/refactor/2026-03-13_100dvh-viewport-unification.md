# 100dvh 뷰포트 통일 — 2026-03-13

> **상태**: 🟢 완료
> **범위**: 소규모
> **keywords**: `viewport-dvh` `mobile` `ios-safari` `layout` `terminal` `graph` `compare` `login`

---

## 동기

모바일 Safari에서는 주소창 변화와 키보드 오픈 시 `100vh` 계열 높이 계산이 실제 가시 뷰포트와 어긋날 수 있다. 전체 높이 페이지를 `100dvh` 기준으로 통일해 오버플로우와 잘림 가능성을 줄인다.

## Before / After

### Before
```tsx
<div className="flex h-screen flex-col">
<main className="flex min-h-screen items-center">
```

### After
```tsx
<div className="flex h-[100dvh] flex-col">
<main className="flex min-h-[100dvh] items-center">
```

## 변경 내역

| 파일 | 변경 내용 |
|------|----------|
| `src/components/terminal/TerminalPage.tsx` | 루트 터미널 레이아웃을 `h-[100dvh]`로 변경 |
| `src/app/login/page.tsx` | 로그인/로딩 fallback의 최소 높이를 `min-h-[100dvh]`로 변경 |
| `src/app/graph/page.tsx` | 그래프 페이지 및 Suspense fallback 높이를 `h-[100dvh]`로 변경 |
| `src/app/compare/page.tsx` | 비교 페이지 및 Suspense fallback 높이를 `h-[100dvh]`로 변경 |
| `src/app/sessions/[id]/page.tsx` | 세션 로딩/에러 상태 높이를 `h-[100dvh]`로 변경 |

## 검증

- [x] 기존 동작 변경 없음 확인
- [x] 관련 타입체크 통과

검증 메모:
- `rg -n "h-screen|min-h-screen" src` 결과 0건
- `npx tsc --noEmit` 통과

---

## 관련 노트
- `../decisions/2026-03-13_mobile-chat-terminal-ux-research.md`
