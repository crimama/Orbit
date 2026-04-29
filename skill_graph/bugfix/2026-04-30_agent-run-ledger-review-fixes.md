# AgentRun Ledger Review Fixes

## 요약

AgentRun durable replay ledger의 code-review 지적사항을 팀 병렬 작업과 별도 평가 에이전트 검증으로 보완했다. 핵심은 같은 run에 대한 event append를 프로세스 내부에서 직렬화하고, raw terminal IO를 기본 저장하지 않으며, AgentRun API 입력을 runtime에서 거절하도록 만든 것이다.

## 원인

- `appendEvent()`가 최신 `seq` 조회 후 `seq + 1` insert를 병렬 실행해 SQLite/Prisma transaction contention에서 event 손실이 발생했다.
- terminal input/output payload가 raw `{ data }` 형태로 durable DB에 저장됐다.
- API route가 TypeScript cast에 기대어 malformed JSON object나 enum/query edge를 충분히 걸러내지 않았다.
- AgentRunsPanel이 mount 시 한 번만 fetch해 active run/event 변화가 UI에 반영되지 않았다.

## 수정

- `src/server/agentRuns/agentRunLedger.ts`: run별 append queue를 추가해 같은 run의 event append를 직렬화하고, `ensureRunForSession()`은 unique conflict 후 기존 row를 재조회한다.
- `src/server/socket/handlers/terminal.ts`: raw IO는 `ORBIT_AGENT_RUN_LEDGER_RAW_IO=1` 또는 `ORBIT_CAPTURE_RAW_TERMINAL_IO=true`일 때만 저장하고, 기본 payload는 capped/redacted preview와 metadata로 제한한다.
- `src/app/api/agent-runs/**`: create/update/events route에 JSON object, enum, cursor, limit, id validation을 추가한다.
- `src/components/dashboard/AgentRunsPanel.tsx`: runs/events bounded polling, stale error clear, selected run validity 유지 로직을 추가한다.

## 검증

- `npx tsc --noEmit`
- `npm run lint`
- `npx prisma validate`
- `npm run build`
- 임시 SQLite DB에서 50-way `appendEvent()` concurrency smoke: `fulfilled=50`, `rejected=0`, `count=50`, contiguous seq 확인.
- create API edge smoke: `runRef: null`, blank `runRef`, blank `sessionId` 모두 400 확인.

## 남은 주의점

현재 append queue는 단일 Node.js 서버 프로세스 내부의 동시성을 해결한다. 여러 Orbit 서버 프로세스가 같은 DB에 동시에 쓰는 배포 형태로 확장할 경우 DB-level sequence reservation 또는 외부 lock이 필요하다.

## 키워드

`AgentRun` `ledger` `terminal-output` `terminal-input` `Prisma` `SQLite` `dashboard` `runtime-validation` `concurrency`
