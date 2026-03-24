# Task: Dashboard Integration - SSH Vault

## Agent
agent-03

## Status
pending

## Description
Dashboard.tsx에 SshVaultPanel을 통합하고 Quick Connect 플로우를 연결한다.

## 파일: src/components/dashboard/Dashboard.tsx

### 변경사항

1. SshVaultPanel import 추가:
   import SshVaultPanel from './SshVaultPanel';

2. Home 화면 (selectedProject === null)의 메인 영역에 SshVaultPanel 렌더링.
   현재 프로젝트 미선택 시 메인 영역에 'Add a project first, then launch sessions here.' 메시지가 표시됨.
   이 영역을 SshVaultPanel로 교체 (또는 그 위에 추가).

3. 콜백 구현:
   - onQuickConnect: (session: SessionInfo) => {
       // 인라인 세션 열기
       setSelectedProject(projects.find(p => p.id === session.projectId) || null);
       setInlineSessionId(session.id);
     }
     
     주의: adhoc 프로젝트는 projects 목록에 없을 수 있으므로,
     Quick Connect 후 해당 프로젝트를 별도로 fetch하여 selectedProject에 설정하거나,
     또는 단순히 setInlineSessionId(session.id)만 호출해도 됨.
     
   - onNewProject: (profileId: string) => {
       setPrefillSshProfileId(profileId);
       setAddProjectMode('ssh');
     }
     
   - onEditProfile: (profileId: string) => {
       // AddSshProjectForm을 editingProfileId + vault mode로 여는 상태 추가
       // 또는 간단히 addProjectMode='ssh'로 열고 initialProfileId 설정
       setPrefillSshProfileId(profileId);
       setAddProjectMode('ssh');
     }
     
   - onAddProfile: () => {
       // vault mode로 SSH 폼 열기 (새 프로파일 저장용)
       // 기존 addProjectMode='ssh'를 활용하되, vault mode 상태 추가 필요
       setAddProjectMode('ssh');
     }

4. Quick Connect 후 세션 열기 플로우:
   가장 간단한 방법: onQuickConnect에서 받은 SessionInfo로 바로 인라인 세션을 열기.
   이를 위해 setInlineSessionId(session.id) 호출.
   selectedProject가 null이어도 터미널은 표시될 수 있어야 함 - 
   현재 BorderlessWorkspace가 inlineSessionId가 있으면 터미널을 렌더링하므로 이 부분 확인.

### 참고
- Dashboard.tsx의 현재 구조: 좌측 사이드바 (프로젝트 목록) + 우측 메인 영역 (세션/터미널)
- selectedProject === null일 때 우측 메인 영역 위치 찾기: 'Add a project first' 텍스트 검색
- BorderlessWorkspace 컴포넌트: inlineSessionId prop으로 터미널 표시
- prefillSshProfileId 상태는 이미 존재 (line ~107)

### 주의사항
- Dashboard.tsx는 큰 파일이므로 필요한 부분만 수정
- 기존 스타일/패턴 유지
- 새 상태 변수 추가 최소화

## Target Files
- `src/components/dashboard/Dashboard.tsx`

## Dependencies
None

## Acceptance Criteria
- [ ] Home 화면에 SshVaultPanel이 렌더링됨
- [ ] Quick Connect 시 터미널이 인라인으로 열림
- [ ] New Project 클릭 시 SSH 프로젝트 생성 폼이 열림
- [ ] 기존 Dashboard 기능에 영향 없음

## Notes
(Orchestrator may add coordination notes here)
