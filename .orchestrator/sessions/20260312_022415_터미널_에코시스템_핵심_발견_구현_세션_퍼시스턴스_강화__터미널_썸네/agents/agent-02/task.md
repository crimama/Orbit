# Task: 프론트엔드: 실시간 세션 갱신 + 프리뷰 UI + 브라우저 알림

## Agent
agent-02

## Status
pending

## Description
3가지 구현:

1. Dashboard.tsx에 session-update 소켓 리스너 추가:
   - 컴포넌트 마운트 시 socket.emit('dashboard-join') 호출
   - socket.on('session-update', (session: SessionInfo) => { setSessions 업데이트 })
   - 기존 세션이면 업데이트, 새 세션이면 추가
   - useEffect cleanup에서 리스너 제거

2. SessionList.tsx에 lastContext 프리뷰 개선:
   - 현재: <div className='truncate text-xs text-neutral-600'>{s.lastContext}</div>
   - 변경: 모노스페이스 폰트, 최대 2줄, 배경색 bg-neutral-900/50, 패딩 추가
   - 빈 lastContext면 표시 안 함

3. 브라우저 Notification API 연동:
   - Dashboard 마운트 시 Notification.requestPermission() 호출
   - session-update에서 status가 terminated로 변경되면:
     new Notification('Session Ended', { body: session.name + ' exited', icon: '/icon-192x192.png' })
   - document.hidden일 때만 알림 (포커스 중이면 불필요)

참고 타입: SessionInfo는 src/lib/types.ts에 정의. status: 'active' | 'paused' | 'terminated'.
소켓 클라이언트: src/lib/socketClient.ts의 OrbitSocket 타입 사용.
AGENTS.md 참조하여 프로젝트 컨벤션 준수.

## Target Files
- `src/components/dashboard/Dashboard.tsx`
- `src/components/dashboard/SessionList.tsx`

## Dependencies
None

## Acceptance Criteria
- [ ] session-update 리스너로 대시보드 자동 갱신
- [ ] lastContext가 모노스페이스 2줄로 표시
- [ ] 세션 종료시 브라우저 알림 발생
- [ ] npx tsc --noEmit 통과

## Notes
(Orchestrator may add coordination notes here)
