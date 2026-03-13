# OLED Dark Mode 인프라 — 2026-03-13

> **상태**: 🟢 완료
> **Phase**: UI Infra
> **keywords**: OLED, theme, dark-mode, localStorage, SSR, tailwind, terminal

---

## 요구사항

`orbit-theme` 값에 따라 기본 테마와 OLED 테마를 전환할 수 있어야 한다.
- `oled` 선택 시 순수 블랙 배경 사용
- 기본 테마의 기존 동작은 유지
- CSS 변수 `--terminal-bg`를 Tailwind에서 재사용 가능
- SSR 환경에서 `window`/`document` 접근 오류가 없어야 함

## 구현 내역

- [x] `src/lib/hooks/useTheme.ts` 추가
- [x] `localStorage`의 `orbit-theme`를 `default|oled`로 검증
- [x] `data-theme`를 `document.documentElement`에 반영
- [x] `src/app/globals.css`에 `--terminal-bg` 기본값 추가
- [x] `[data-theme="oled"]`에서 `--background`, `--terminal-bg`를 순수 블랙으로 오버라이드
- [x] `tailwind.config.ts`에 `terminalBg` 색상 토큰 추가

## 테스트

- [x] `npx tsc --noEmit`

## 관련 노트

- 연관: `skill_graph/decisions/2026-03-13_mobile-chat-terminal-ux-research.md`
- 연관: `skill_graph/features/2026-03-12_frontend-component-specification.md`
