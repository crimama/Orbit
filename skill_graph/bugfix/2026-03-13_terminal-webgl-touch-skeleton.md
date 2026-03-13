# Terminal WebGL 손실 + 터치 탭 + 스켈레톤 — 2026-03-13

> **심각도**: 🟠 Major
> **상태**: 🟢 해결
> **keywords**: `terminal` `webgl` `context-loss` `mobile` `touch` `skeleton`

---

## 증상

- `@xterm/addon-webgl` 초기화 실패나 WebGL 컨텍스트 손실이 발생하면 터미널 렌더링 경로가 불안정해질 수 있었다.
- 모바일에서 터치 위치로 커서를 옮길 수 없어 긴 명령 편집이 불편했다.
- 세션 준비 중 기존 회전 스피너는 터미널 문맥과 맞지 않아 상태 전달력이 낮았다.

## 원인

- WebGL 애드온이 정적 의존처럼 취급되어, 실패/손실 시 런타임 폴백 경로와 상태 로그가 없었다.
- 터치 입력은 탭과 스크롤을 구분하는 제스처 레이어가 없었다.
- 로딩 UI가 터미널 전용 skeleton 대신 일반 spinner에 머물러 있었다.

## 수정

### 변경 파일
| 파일 | 변경 내용 |
|------|----------|
| `src/components/terminal/TerminalView.tsx` | WebGL 동적 로드, context loss fallback, touch tap cursor move, skeleton UI 추가 |

### 수정 내용
```diff
+ WebGL addon을 try/catch로 동적 import
+ webglcontextlost 감지 후 addon dispose + canvas fallback
+ touchstart/touchend 10px 임계값으로 탭 판정
+ 터치 셀까지 화살표 시퀀스를 전송해 커서 이동
+ spinner 대신 5-bar pulsing terminal skeleton 적용
```

## 검증

- [x] `npx tsc --noEmit`
- [ ] 브라우저에서 실제 `webglcontextlost` 강제 재현
- [ ] 모바일 실기기 터치 제스처 수동 확인
- [ ] 회귀 테스트 추가

---

## 관련 노트

- [모바일 채팅/터미널 UX 리서치](../decisions/2026-03-13_mobile-chat-terminal-ux-research.md)
- [프론트엔드 상세명세서](../features/2026-03-12_frontend-component-specification.md)
