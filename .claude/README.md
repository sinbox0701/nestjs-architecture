# `.claude/` — 하네스 구성

backend-template의 Claude Code 하네스(에이전트 협업 환경) 구성요소다. "누가 작업해도 같은 품질"이 나오도록 시스템 프롬프트·스킬·서브에이전트·훅·설정을 모아둔다.

| 경로                  | 역할                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `commands/`           | **슬래시 커맨드(스킬) 10개** — SDD 파이프라인(`/spec` `/issues` `/scaffold` `/review` `/test` `/migration` `/fe-changes` `/commit` + `/status` `/mock-seed`). 메인 컨텍스트에서 실행.       |
| `agents/`             | **서브에이전트** — 별도 컨텍스트에서 도는 전문가. `description`을 보고 Claude가 위임. 현재: `convention-reviewer`(컨벤션 리뷰), `migration-reviewer`(마이그레이션 안전성). 둘 다 읽기 전용. |
| `hooks/`              | **훅 스크립트** — `session-context.sh`(SessionStart: git 컨텍스트 주입), `guard-bash.mjs`(PreToolUse: 위험 명령 차단).                                                                      |
| `settings.json`       | 훅 등록(공유·추적). SessionStart / PreToolUse(Bash) / Stop(포맷).                                                                                                                           |
| `settings.local.json` | 개인 설정(gitignore).                                                                                                                                                                       |
| `config.json`         | 프로젝트 통합 타깃(Linear/Orval 등). 스킬이 참조, 하드코딩 금지.                                                                                                                            |
| `templates/linear/`   | `/issues`가 읽는 Linear 이슈 템플릿.                                                                                                                                                        |
| `.mcp.json.example`   | MCP 서버 템플릿(루트). 쓰려면 `.mcp.json`으로 복사 후 크레덴셜 입력(.mcp.json은 gitignore).                                                                                                 |

## 층 요약

1. **시스템 프롬프트** — `CLAUDE.md` + `docs/convention/`.
2. **스킬** — `commands/` (명시적 `/명령`).
3. **서브에이전트** — `agents/` (컨텍스트 격리 위임, `description` 트리거).
4. **훅** — `hooks/` + `settings.json`: SessionStart(컨텍스트 주입) / PreToolUse(위험명령 exit 2 차단) / Stop(prettier+eslint 일괄).
5. **가드레일** — husky pre-commit + CI(`dep:check`·드리프트·lint·typecheck·3계층 테스트).
6. **오케스트레이션** — `CLAUDE.md` SDD 파이프라인 맵의 "다음 단계 추천".

## 서브에이전트 작성법

`agents/<name>.md` — YAML frontmatter(`name`·`description` 필수, `tools`·`model` 선택) + 본문(시스템 프롬프트). `description`에 "~할 때 proactively 사용"을 적으면 Claude가 자동 위임 판단한다. (`invoke-when` 같은 필드는 없음 — 트리거는 `description`이다.)

## 훅 추가법

`settings.json`의 해당 이벤트 배열에 `{ type: "command", command, timeout }`를 추가한다. `PreToolUse`는 `matcher`(도구명)로 필터. 차단은 **exit 2 + stderr 사유**, 컨텍스트 주입은 stdout(SessionStart) 또는 JSON `hookSpecificOutput.additionalContext`. 상세: https://code.claude.com/docs/en/hooks
