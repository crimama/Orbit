# 프로젝트 하네스 + oh-my-opencode + 세션 UX 개선 — 2026-02-28

> **상태**: 🟢 완료
> **Phase**: Phase 4
> **keywords**: harness, oh-my-opencode, project-settings, chat-ui, session-ux

---

## 요구사항

- 프로젝트 단위로 하네스 엔지니어링 설정을 관리할 수 있어야 한다.
- oh-my-opencode에 맞춘 프리셋/전문화 옵션이 필요하다.
- 세션 UI를 기존 터미널 위주 톤에서 더 사용하기 쉬운 채팅형 워크스페이스로 개선한다.

## 설계

### 변경 범위

- `prisma/schema.prisma`
- `src/app/api/projects/[id]/harness/route.ts`
- `src/lib/types.ts`
- `src/components/dashboard/ProjectHarnessPanel.tsx`
- `src/components/dashboard/Dashboard.tsx`
- `src/components/terminal/TerminalPage.tsx`
- `src/components/terminal/TerminalPane.tsx`
- `src/components/terminal/TerminalView.tsx`
- `src/components/terminal/SessionMetricsPanel.tsx`
- `src/app/sessions/[id]/page.tsx`

### 접근 방식

- Prisma에 프로젝트 1:1 하네스 모델을 추가해 설정 저장소를 분리했다.
- 프로젝트 하네스 전용 REST 엔드포인트를 추가하고 JSON config 유효성 검증을 넣었다.
- Dashboard에 하네스 편집 패널을 삽입해 프로젝트 컨텍스트 안에서 즉시 수정 가능하게 했다.
- oh-my-opencode 프리셋 버튼으로 안전한 기본값을 빠르게 적용할 수 있게 했다.
- 세션 화면의 컨테이너/헤더/칩 스타일을 개선해 대화형 워크스페이스 느낌으로 정돈했다.

### API / 인터페이스

```typescript
// New model
ProjectHarnessConfig {
  projectId @unique
  enabled
  provider // "oh-my-opencode" | "claude-code" | "codex" | "terminal"
  profileName
  autoApproveSafe
  maxParallel
  config // JSON string
}

// New endpoint
GET /api/projects/[id]/harness
PUT /api/projects/[id]/harness
```

---

## 구현 내역

- [x] 프로젝트 하네스 Prisma 모델 추가
- [x] Prisma Client 재생성 및 DB 동기화
- [x] 하네스 설정 API 추가
- [x] Dashboard 하네스 패널 컴포넌트 추가
- [x] oh-my-opencode 프리셋 추가
- [x] 세션 UI 톤 개선

### 주요 변경 파일

| 파일                                               | 변경 내용                                                       |
| -------------------------------------------------- | --------------------------------------------------------------- |
| `prisma/schema.prisma`                             | `ProjectHarnessConfig` 모델 추가, `Project`와 1:1 relation 추가 |
| `src/app/api/projects/[id]/harness/route.ts`       | 하네스 GET/PUT API + provider/maxParallel/config 검증           |
| `src/lib/types.ts`                                 | 하네스 provider/config 타입 추가                                |
| `src/components/dashboard/ProjectHarnessPanel.tsx` | 프로젝트별 하네스 설정 UI, 프리셋 적용/저장                     |
| `src/components/dashboard/Dashboard.tsx`           | 프로젝트 상세 영역에 Harness 패널 연결                          |
| `src/components/terminal/*`                        | 세션 화면을 카드/칩 기반으로 리디자인                           |

---

## 테스트

- [x] 타입 체크: `npx tsc --noEmit`
- [x] 린트: `npm run lint`
- [x] 빌드: `npm run build`
- [ ] 테스트: `npm test` (스크립트 미정의)

---

## 회고

### 잘된 점

- 하네스 설정을 프로젝트에 귀속시켜 다중 프로젝트 운용 시 일관성이 좋아졌다.
- oh-my-opencode 프리셋으로 초기 설정 장벽을 줄였다.

### 개선할 점

- 하네스 설정 변경 이력(history/audit) UI는 후속 작업으로 남아 있다.
- 세션 화면의 메시지 그룹핑/타임라인 같은 완전한 채팅 인터랙션은 추후 확장 여지가 있다.

### 교훈 → `tasks/lessons.md` 반영 여부

- [x] 반영 불필요

---

## 관련 노트

- 선행: `../decisions/2026-02-28_harness-engineering.md`
- 선행: `../features/2026-02-28_phase2-4-parallel.md`
- 후속: 프로젝트 하네스 이력/복원, 세션 포크 UI
