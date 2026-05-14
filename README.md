# Agent Orbit

Mac 앱으로 Claude Code, Codex, OpenCode 같은 AI 에이전트 세션을 열고 관리하는 Orbit 클라이언트입니다.

이 README는 **Mac 앱으로 쓰는 경우**를 기준으로 설명합니다. Orbit은 앱 창 안에서 Orbit UI를 띄우며, 백엔드는 두 방식 중 하나로 연결합니다.

| Mode | Backend | Mac App |
| ---- | ------- | ------- |
| Remote URL | 다른 서버/데스크탑에서 실행 | 원격 Orbit 주소에 접속 |
| This Mac | MacBook 자체에서 실행 | 앱이 로컬 Orbit 서버에 접속 |

## 0. Orbit CLI 설치

소스 체크아웃 후 한 번만 의존성을 설치하고 `orbit` 명령을 등록합니다.

```bash
git clone <orbit-repo-url>
cd Orbit-mac
npm install
```

`npm install`이 끝나면 현재 소스 체크아웃의 `bin/orbit.mjs`가 npm global bin에 자동 연결됩니다. 자동 연결을 건너뛰려면:

```bash
ORBIT_SKIP_CLI_LINK=1 npm install
```

자동 연결이 실패하거나 PATH가 맞지 않으면 수동으로 등록할 수 있습니다.

```bash
npm link
```

이후에는 반복 사용 시 `npm run ...` 대신 아래 명령을 사용합니다.

```bash
orbit start server
orbit start server --tailnet
orbit install mac-app
orbit access-code show
orbit doctor
```

## 1. 원격 서버에 Mac 앱으로 접속

서버나 데스크탑에서 Orbit 백엔드를 실행하고, Mac 앱은 클라이언트처럼 접속하는 방식입니다. 여러 기기에서 같은 Orbit에 들어가려면 이 방식을 권장합니다.

### 서버에서 실행

```bash
git pull
npm install
```

Access code를 먼저 만들거나 확인합니다.

```bash
orbit access-code rotate
orbit access-code show
```

Tailscale로 원격 접속을 열려면:

```bash
export SSH_PASSWORD_SECRET="change-this-if-you-use-ssh-passwords"
orbit start server --tailnet
```

서버 출력에 표시되는 Tailscale 주소를 확인합니다.

```txt
http://<tailscale-ip>:3000
```

### Mac 앱에서 접속

1. Orbit Mac 앱을 엽니다.
2. 연결 방식에서 `Remote URL`을 선택합니다.
3. URL에 `http://<tailscale-ip>:3000`을 입력합니다.
4. 로그인 화면에서 access code를 입력합니다.

앱이 원격 Orbit UI에 붙는 구조라서, 이 모드에서는 Mac 앱이 서버를 직접 띄우지 않습니다.

## 2. Mac 자체에서 Orbit 앱 실행

MacBook 안에서 Orbit 백엔드도 실행하고, Mac 앱도 그 로컬 서버에 붙는 방식입니다. 브라우저 대신 앱처럼 쓰고 싶을 때 사용합니다.

### Mac에서 준비

```bash
git pull
npm install
```

Access code를 설정합니다.

```bash
orbit access-code set "your-strong-access-code"
```

또는 자동 생성합니다.

```bash
orbit access-code rotate
```

### Mac 앱 빌드 및 실행

```bash
orbit install mac-app --open
```

앱이 열리면 `This Mac` 또는 local 연결 방식을 선택합니다.

기본값은 Mac 자체 서버를 포함하는 local 앱입니다. 원격 Orbit URL에 접속하는 가벼운 앱만 설치하려면:

```bash
orbit install mac-app --remote --open
```

앱을 복사하지 않고 빌드 산출물만 만들려면:

```bash
orbit install mac-app --no-copy
```

설치 위치를 지정하려면:

```bash
orbit install mac-app --install-dir "$HOME/Applications"
```

## Access Code 관리

Access code는 Orbit 로그인에 쓰는 비밀번호입니다. 기본 저장 위치는 `~/.orbit/access-token`입니다.

현재 access code 확인:

```bash
orbit access-code show
```

새 access code 생성:

```bash
orbit access-code rotate
```

원하는 값으로 지정:

```bash
orbit access-code set "your-strong-access-code"
```

환경변수로 직접 지정할 수도 있습니다.

```bash
ORBIT_ACCESS_CODE="your-strong-access-code" orbit start server
```

기존 이름인 `ORBIT_ACCESS_TOKEN`도 호환됩니다.

## 설치 상태 점검

Mac 앱이나 로컬 서버가 켜지지 않을 때는 먼저 진단 명령을 실행합니다.

```bash
orbit doctor
```

특정 포트를 기준으로 확인하려면:

```bash
orbit doctor --port 3000
```

이 명령은 Node/npm, 의존성, Prisma client, SQLite DB, access code, 포트 점유, Mac 앱 빌드 산출물, `claude`/`codex`/`opencode` CLI 인식 여부를 확인하고 필요한 복구 명령을 같이 보여줍니다.

## Mac 앱에서 세션 열기

1. 프로젝트를 선택합니다.
2. `Terminal`, `Claude Code`, `Codex`, `OpenCode` 중 하나를 선택합니다.
3. 세션 탭이 열리면 터미널 또는 채팅 입력을 사용합니다.
4. Mac 앱 채팅 입력은 일반 `Enter`가 전송이고, `Option+Enter`가 줄바꿈입니다.

로컬 앱 모드에서 agent CLI가 바로 종료되면 터미널 안에 종료 코드와 오류 메시지가 남습니다. 아래 명령으로 Mac login shell에서 CLI가 잡히는지 확인합니다.

```bash
zsh -lic 'command -v claude; command -v codex; command -v opencode'
```

## 문제 해결

### `Forbidden: API is restricted to loopback access`

기본 로컬 서버를 다른 기기에서 열려고 한 상태입니다. 원격 접속은 서버에서 Tailnet 모드로 실행해야 합니다.

```bash
orbit start server --tailnet
```

### `Remote access requires a configured ORBIT_ACCESS_CODE`

원격 모드는 보안상 최초 access code 설정을 원격에서 허용하지 않습니다. 서버에서 먼저 생성합니다.

```bash
orbit access-code rotate
```

그 다음 다시 실행합니다.

```bash
orbit start server --tailnet
```

### `The table main.AgentSession does not exist`

SQLite schema가 아직 적용되지 않은 상태입니다.

```bash
orbit start server
```

### Mac 로컬 세션이 바로 꺼짐

앱 안의 터미널에 남은 오류 메시지를 먼저 확인합니다. CLI 경로 문제라면 Mac login shell에서 아래 명령이 모두 잡혀야 합니다.

```bash
zsh -lic 'command -v claude; command -v codex; command -v opencode'
```

필요한 CLI가 없다면 설치하거나 shell profile의 `PATH`를 정리합니다.

## 개발 확인

```bash
npx tsc --noEmit
npm run lint
```

## License

MIT
