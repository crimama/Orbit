# Project Add SSH Vault Reuse

## 요약

SSH 프로젝트 추가 폼에서 기존 SSH Vault 프로필을 직접 선택해 프로젝트를 만들 수 있게 했다. 저장된 프로필을 선택한 경우 새 SSH config를 만들거나 재검증을 강제하지 않고 기존 `sshConfigId`를 `/api/projects` 생성 요청에 그대로 연결한다.

## 문제

- Dashboard의 일반 `+ Project > SSH` 경로에는 저장된 vault 프로필 선택 UI가 없었다.
- Vault panel의 `+ Project`에서 profile id를 넘겨도 폼은 해당 프로필 값을 복사한 뒤 `Test Connection`으로 새 임시 SSH config를 만들고, 프로젝트도 그 새 config에 연결했다.
- 결과적으로 사용자는 이미 저장한 host/password/key/proxy/default path 정보를 프로젝트 추가 시 재사용한다고 체감하기 어려웠다.

## 수정

- `src/components/dashboard/AddSshProjectForm.tsx`
  - 프로젝트 모드에 `SSH Vault` / `New Host` source를 추가했다.
  - vault source에서는 `/api/ssh-configs` 목록에서 프로필을 선택하고 host/default path/default container 요약을 표시한다.
  - 선택된 프로필은 `RemoteDirectoryPicker`, remote Docker container 조회, 프로젝트 생성의 active SSH config id로 사용한다.
  - 새 host source는 기존 test-first flow를 유지하고, source 전환 시 버려진 임시 test config를 삭제한다.
  - vault source에서는 profile metadata 입력과 default path/default container 수정 입력을 숨겨 프로젝트 생성이 기존 프로필을 수정하지 않게 했다.
- `src/components/dashboard/Dashboard.tsx`
  - 일반 SSH 프로젝트 탭 진입 시 이전 vault edit/prefill 상태가 남지 않도록 project mode로 초기화한다.

## 동작 계약

- 저장된 vault로 SSH 프로젝트 생성:
  - required: project name, vault profile, remote path
  - optional: target docker container
  - request: `POST /api/projects` with `type: "SSH"`, `path`, `sshConfigId: selectedProfile.id`
- 새 host로 SSH 프로젝트 생성:
  - 기존처럼 `Test Connection` 성공 후 프로젝트 생성
  - 성공한 temp SSH config는 프로젝트의 SSH config로 보존
- Vault profile 저장/편집:
  - 기존 test-first 저장 흐름 유지

## 검증

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- 기존 dev server 확인: `curl -I http://127.0.0.1:3000` returns `302 /login?next=%2F`

## 키워드

`project-add` `SSH` `ssh-vault` `vault` `sshConfigId` `dashboard`
