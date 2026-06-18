#!/bin/sh
# SessionStart 훅: 세션 시작 시 git 컨텍스트를 Claude에 주입한다.
# stdout이 그대로 Claude 컨텍스트로 들어간다(SessionStart 한정). 읽기 전용·빠르게.

branch=$(git branch --show-current 2>/dev/null)
dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
ahead=$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo '?')
last=$(git log -1 --pretty='%h %s' 2>/dev/null)

echo "[backend-template] 브랜치: ${branch:-?} | 미커밋 파일: ${dirty} | 미푸시 커밋: ${ahead}"
echo "마지막 커밋: ${last:-(none)}"
echo "참고: 컨벤션 docs/convention/, 접근제어 06, 관측성 13. 커밋은 명시 지시 시에만."
