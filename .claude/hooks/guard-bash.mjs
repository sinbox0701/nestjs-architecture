#!/usr/bin/env node
// PreToolUse(Bash) 훅: 되돌리기 어려운 위험 명령을 차단한다(exit 2 → 도구 호출 차단).
// stderr 사유가 Claude에 전달되어 안전한 대안을 찾게 한다. 정말 필요하면 사용자가 직접 실행.
// 보수적으로 — 일상 명령(빌드/테스트/일반 git/docker)은 막지 않는다.

let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  let command = '';
  try {
    command = JSON.parse(input)?.tool_input?.command ?? '';
  } catch {
    process.exit(0); // 파싱 실패 시 통과(가드는 best-effort)
  }

  const dangers = [
    {
      re: /\bgit\s+push\b[^\n]*(--force\b|--force-with-lease\b|\s-f\b)/,
      msg: 'force push 차단 — 원격 히스토리 덮어쓰기 위험. 필요하면 직접 실행하세요.',
    },
    {
      re: /\bdrop\s+(table|database|schema)\b/i,
      msg: 'DROP TABLE/DATABASE/SCHEMA 차단 — 스키마 변경은 마이그레이션으로 처리하세요.',
    },
    { re: /\bgit\s+reset\s+--hard\b/, msg: 'git reset --hard 차단 — 작업 손실 위험. 정말 버릴 거면 직접 실행하세요.' },
    {
      // 루트 절대경로(`/`, `/etc` …)와 홈/$HOME *자체*만 차단. `~/sub`·`$HOME/sub` 같은 홈 하위 경로는
      // 정상 작업이라 통과(과거 `~/tmp` 오탐 수정).
      re: /\brm\s+-[a-z]*r[a-z]*f?[a-z]*\s+(\/|~(\s|$)|\$HOME(\s|$))/,
      msg: 'rm -rf 루트/홈 차단.',
    },
    {
      // 훅 우회(--no-verify) 커밋 차단. lint/format/드리프트 가드를 건너뛰지 못하게 한다.
      // (-n 단축형은 커밋 메시지 안의 '-n' 문자열을 오탐하므로 제외 — --no-verify만 매칭.)
      re: /\bgit\b[^\n]*\bcommit\b[^\n]*--no-verify\b/,
      msg: '훅 우회(--no-verify) 커밋 차단 — lint/format 가드를 통과시키세요.',
    },
  ];

  for (const d of dangers) {
    if (d.re.test(command)) {
      process.stderr.write(`[guard-bash] ${d.msg}\n`);
      process.exit(2);
    }
  }
  process.exit(0);
});
