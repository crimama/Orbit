# Plan: SSH 연결 저장 및 재사용 기능

## Query
/translate SSH 연결 저장 및 재사용 기능 추가

## Created
2026-03-22T14:37:17.038733

## 요구사항 분석

**현재 상태:**
- SshConfig 모델과 CRUD API가 이미 존재함
- AddSshProjectForm에 `mode="vault"` 로 SSH 저장 기능이 부분적으로 존재
- 하지만 프로젝트 없이 SSH로 바로 터미널 연결하는 기능이 없음
- SSH 프로파일 목록을 한눈에 보고 관리하는 전용 UI가 없음

**목표:**
1. SSH 프로파일을 저장하고, 새 프로젝트 생성 시 저장된 프로파일을 선택할 수 있도록
2. 저장된 SSH 프로파일에서 프로젝트 없이 바로 터미널 연결

## 결정사항
- Quick Connect: adhoc 프로젝트 자동생성 방식 (DB 스키마에 `adhoc` 플래그 추가, 프로젝트 목록에서 필터링)
- UI: Home 화면 (프로젝트 미선택 시) 메인 영역에 SSH Vault 패널 배치

## 작업 분해

### Agent-01: SSH Quick-Connect Backend
**파일:**
- `prisma/schema.prisma` — Project에 `adhoc Boolean @default(false)` 추가
- `src/app/api/ssh-configs/[id]/connect/route.ts` — Quick Connect 엔드포인트 신규
- `src/app/api/projects/route.ts` — GET에서 adhoc 프로젝트 필터링

로직:
1. `POST /api/ssh-configs/{id}/connect` 호출 시
2. 해당 sshConfigId로 adhoc=true인 프로젝트 검색, 있으면 재사용
3. 없으면 adhoc 프로젝트 생성 (name=label||host, path=defaultPath||"~", type="SSH")
4. 해당 프로젝트에 terminal 세션 생성 (기존 sessionManager.createSession 재사용)
5. 세션 정보 반환

### Agent-02: SSH Vault Panel UI
**파일:**
- `src/components/dashboard/SshVaultPanel.tsx` — 신규 컴포넌트

기능:
- GET /api/ssh-configs로 저장된 프로파일 목록 조회
- 각 프로파일 카드: label (또는 host), username@host:port, tags
- 버튼: ▶ Connect (quick connect) / + Project / ✎ Edit / ✕ Delete
- Add Profile 버튼
- 연결 상태 표시 (socket ssh-status 이벤트 활용)
- 콜백: onQuickConnect(sessionInfo), onNewProject(profileId), onEditProfile(profileId), onAddProfile()

### Agent-03: Dashboard Integration
**파일:**
- `src/components/dashboard/Dashboard.tsx` — SshVaultPanel 통합

통합:
- Home 화면 (selectedProject === null) 메인 영역에 SshVaultPanel 렌더링
- onQuickConnect → 세션을 인라인으로 열기 (setInlineSessionId)
- onNewProject → setPrefillSshProfileId + setAddProjectMode("ssh")
- onEditProfile → AddSshProjectForm을 editingProfileId와 vault mode로 열기
- onAddProfile → AddSshProjectForm을 vault mode로 열기

## 의존성 관계
```
Agent-01 (Backend) ──┐
                     ├── Agent-03 (Dashboard Integration)
Agent-02 (UI)      ──┘
```

Agent-01, Agent-02는 병렬 실행.
Agent-03는 Agent-01, Agent-02 완료 후 실행.
