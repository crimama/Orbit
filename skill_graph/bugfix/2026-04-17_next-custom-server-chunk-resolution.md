# Next custom server chunk resolution — 2026-04-17

> **심각도**: 🟠 Major
> **상태**: 🟢 해결
> **keywords**: next.js, custom server, tsx, chunk, webpack-runtime, tsconfig

---

## 증상

개발 서버에서 `Cannot find module './1682.js'` 오류가 `.next/server/webpack-runtime.js` 경로에서 발생하며,
`app/api/skills/route.js` 같은 App Router route를 로드할 때 Next.js 서버가 깨졌다.

## 원인

커스텀 서버 실행 경로가 repo의 서버 전용 TypeScript 설정을 실제로 사용하지 않고 있었다.

1. `package.json`의 `dev`/`start` 스크립트가 기본 `tsconfig.json` 기준으로 `tsx`를 실행했다.
2. repo 루트 `tsconfig.json`은 `moduleResolution: "bundler"`를 사용하지만, 서버 전용 `tsconfig.server.json`은 `module: "commonjs"`로 바꾸고도 `moduleResolution`을 override하지 않아 **invalid config 조합**이었다.
3. `dev` 스크립트는 `tsx --tsconfig ... watch server.ts`처럼 잘못된 인자 순서를 사용해, `watch`를 명령이 아니라 스크립트처럼 해석할 수 있는 상태였다.

이 조합 때문에 custom server + Next dev runtime 경계에서 chunk/module resolution이 불안정해졌고,
stale or missing `.next` chunk처럼 보이는 오류로 surfaced 되었다.

## 수정

### 변경 파일

| 파일                   | 변경 내용                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `package.json`         | `tsx` dev/start 스크립트가 `tsconfig.server.json`을 사용하도록 수정하고 `watch` 인자 순서를 바로잡음 |
| `tsconfig.server.json` | `module: commonjs`와 호환되도록 `moduleResolution: node` 명시                                        |

### 수정 내용

```diff
- "dev": "rm -rf .next && tsx watch server.ts"
- "start": "NODE_ENV=production tsx server.ts"
+ "dev": "rm -rf .next && tsx watch --tsconfig tsconfig.server.json server.ts"
+ "start": "NODE_ENV=production tsx --tsconfig tsconfig.server.json server.ts"

+ "moduleResolution": "node"
```

## 검증

- [x] `npx tsc --noEmit -p tsconfig.server.json`
- [x] `npx tsx --tsconfig tsconfig.server.json --eval "console.log(...)"`
- [x] `npm run dev` smoke test (20s timeout 동안 custom server 정상 부팅 확인)
- [x] `npm run build`
- [x] `npx tsc --noEmit`

---

## 관련 노트

- `../features/2026-02-27_phase1-infra.md`
