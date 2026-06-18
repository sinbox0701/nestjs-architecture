#!/usr/bin/env bash
#
# Claude Code PreToolUse(Bash) hook — lightweight commit guard.
# 훅 우회 플래그(--no-verify / -n)로 커밋하려는 시도를 차단한다.
# 그 외 명령은 그대로 통과시킨다(exit 0).
#
set -uo pipefail

cmd="$(cat)"

# git commit 이 아니면 통과
printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+commit' || exit 0

# 훅 우회 플래그가 있으면 차단
if printf '%s' "$cmd" | grep -Eq '(--no-verify|[[:space:]]-n([[:space:]]|$))'; then
  echo 'commit guard: 훅 우회(--no-verify) 커밋은 차단됩니다. lint/format 훅을 통과시키세요.' >&2
  exit 2
fi

exit 0
