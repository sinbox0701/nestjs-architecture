#!/usr/bin/env bash
#
# Claude Code PostToolUse hook.
# 편집된 TypeScript 파일에 prettier --write + eslint --fix 를 적용한다.
# Edit/Write/MultiEdit 후 자동 실행된다.
#
set -uo pipefail

# CLAUDE_FILE_PATHS 는 공백 구분의 편집 대상 경로 목록.
files="${CLAUDE_FILE_PATHS:-}"
[ -z "$files" ] && exit 0

for path in $files; do
  case "$path" in
    *.ts | *.tsx)
      [ -f "$path" ] || continue
      pnpm exec prettier --write "$path" >/dev/null 2>&1 || true
      pnpm exec eslint --fix "$path" >/dev/null 2>&1 || true
      ;;
  esac
done

exit 0
