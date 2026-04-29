# LLM_WIKI.md

이 프로젝트는 중앙 지식 베이스 `LLM-WIKI`를 외부 참조로 사용한다.

## Canonical Paths

- Vault root: `/home/hun/GoogleDrive/LLM-WIKI`
- Start page: `/home/hun/GoogleDrive/LLM-WIKI/index.md`
- Project hub: `/home/hun/GoogleDrive/LLM-WIKI/wiki/projects/devleopment-orbit.md`
- Mirrored skill graph: `/home/hun/GoogleDrive/LLM-WIKI/wiki/skill-graphs/devleopment-orbit/`

## When To Use

- 현재 repo 안에서 이전 설계 결정, 실험 기록, 리서치 노트가 필요할 때
- raw PDF만으로 부족하고 Zotero 메타데이터, 논문 노트, citekey가 필요할 때
- 다른 프로젝트의 유사한 구현/실패 사례를 보고 싶을 때

## CLI

```bash
python3 /home/hun/GoogleDrive/LLM-WIKI/tools/llm_wiki_cli.py project --cwd
python3 /home/hun/GoogleDrive/LLM-WIKI/tools/llm_wiki_cli.py search-notes "ssh mobile" --cwd
python3 /home/hun/GoogleDrive/LLM-WIKI/tools/llm_wiki_cli.py search-papers "terminal orchestration"
python3 /home/hun/GoogleDrive/LLM-WIKI/tools/llm_wiki_cli.py paper zhang2025SuperAD
```

## Rule

repo-local 맥락으로 충분하지 않으면 먼저 이 파일을 통해 중앙 위키를 조회하고, 재탐색을 최소화한다.

## After Writing

이 repo 안의 장기 지식 문서(`skill_graph/**/*.md`, `analysis/**/*.md`, ADR, 실험 요약 등)를 추가하거나 의미 있게 수정했으면 완료 전에 아래 큐를 남긴다.

```bash
python3 /home/hun/GoogleDrive/LLM-WIKI/tools/llm_wiki_cli.py queue-project-update --cwd --path <changed-path> --summary "<what changed>"
```

이 큐는 추후 `LLM-WIKI` 전담 에이전트가 `python3 /home/hun/GoogleDrive/LLM-WIKI/tools/llm_wiki_manager.py process --run-sync`로 검토하고 중앙 허브를 갱신한다. 코드만 바뀌고 재사용 지식이 늘지 않은 경우는 생략 가능하다.
