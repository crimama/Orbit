# Task: SSH Vault Panel UI Component

## Agent
agent-02

## Status
pending

## Description
대시보드 Home 화면에 표시할 SSH Vault 패널 컴포넌트를 구현한다.

## 파일: src/components/dashboard/SshVaultPanel.tsx (신규)

'use client' 컴포넌트. 저장된 SSH 프로파일 목록을 보여주고 Quick Connect, 프로젝트 생성, 편집, 삭제 액션을 제공한다.

### Props 인터페이스
interface SshVaultPanelProps {
  onQuickConnect: (session: SessionInfo) => void;
  onNewProject: (profileId: string) => void;
  onEditProfile: (profileId: string) => void;
  onAddProfile: () => void;
}

### 기능 요구사항
1. 마운트 시 GET /api/ssh-configs로 프로파일 목록 조회
2. 각 프로파일을 카드/행으로 표시:
   - 레이블: config.label || config.host
   - 서브타이틀: config.username@config.host:config.port
   - 태그: config.tags (쉼표 구분 → 개별 뱃지)
3. 각 프로파일 카드에 액션 버튼:
   - ▶ Connect: POST /api/ssh-configs/{id}/connect 호출 → onQuickConnect(sessionInfo) 콜백
   - + Project: onNewProject(config.id) 콜백
   - ✎ Edit: onEditProfile(config.id) 콜백
   - ✕ Delete: DELETE /api/ssh-configs/{id} 호출 → 목록 새로고침
4. 상단에 '+ Add SSH Profile' 버튼 → onAddProfile() 콜백
5. 빈 상태: 프로파일이 없을 때 안내 메시지 표시
6. Connect 버튼 클릭 시 로딩 상태 표시

### 스타일링
- 프로젝트 기존 스타일과 일치: Tailwind CSS 사용
- 다크 테마: bg-neutral-900, text-neutral-100 계열
- border-neutral-700/800, hover:bg-neutral-800 패턴
- 소형 텍스트: text-xs, text-sm
- 참고할 기존 컴포넌트: src/components/dashboard/ProjectList.tsx (리스트 스타일 참고)
- 참고할 기존 컴포넌트: src/components/dashboard/SessionList.tsx (카드 레이아웃 참고)

### 타입 import
import type { SshConfigInfo, SessionInfo, ApiResponse, ApiError } from '@/lib/types';

### SSH 연결 상태 (선택적)
useSocket()으로 'ssh-status' 이벤트를 수신하여 각 프로파일의 연결 상태를 실시간 표시 가능.
하지만 기본 구현에서는 생략하고, Connect 버튼의 로딩 상태만 표시해도 됨.

### 주의사항
- 'use client' 지시어 필수
- fetch API 사용 (axios 아님)
- 삭제 시 확인 prompt 또는 confirm 대화상자
- 에러 처리: fetch 실패 시 에러 메시지 표시

## Target Files
- `src/components/dashboard/SshVaultPanel.tsx`

## Dependencies
None

## Acceptance Criteria
- [ ] SshVaultPanel 컴포넌트가 SshConfigInfo[] 목록을 렌더링
- [ ] Connect 버튼이 POST /api/ssh-configs/{id}/connect 호출
- [ ] Delete가 확인 후 실행
- [ ] Props 콜백이 올바르게 전달
- [ ] 기존 다크 테마 스타일과 일관성

## Notes
(Orchestrator may add coordination notes here)
