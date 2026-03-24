# Development Plan

## Query
/translate 파일 업로드 기능 추가

## Created
2026-03-19T17:50:00.265694

## Plan

### 요구사항
사용자가 로컬 파일을 프로젝트 디렉토리에 드래그앤드롭 또는 클릭으로 업로드.

### agent-01: 타입 + 서버 함수 (uploadProjectFile)
- `src/lib/types.ts` — `ProjectFileUploadResponse` 타입 추가
- `src/lib/constants.ts` — `PROJECT_FILES_MAX_UPLOAD_BYTES` (20MB)
- `src/server/files/projectFiles.ts` — `uploadProjectFile(project, rawPath, buffer)` 함수
  - LOCAL/SSH/DOCKER 3종 백엔드 지원
  - 기존 보안 검증 재사용

### agent-02: API 라우트 (`/files/upload`)
- `src/app/api/projects/[id]/files/upload/route.ts` — POST multipart/form-data
- 다중 파일 지원, 응답: `{ data: { uploaded: [...] } }`
- deps: agent-01

### agent-03: 프론트엔드 — SidebarFileTree 업로드 UI
- 컨텍스트 메뉴 "Upload Files" 항목
- 드래그앤드롭 + hidden file input
- 업로드 진행 피드백 + 완료 후 목록 새로고침
- deps: agent-02

### 의존성
```
agent-01 → agent-02 → agent-03
```

### 파일 충돌: 없음
