#!/usr/bin/env node
/**
 * Claude Code Stop 훅: 턴이 끝날 때 그동안 변경된 파일을 한 번에 포맷한다.
 *
 * 매 편집마다(PostToolUse) 돌지 않고, Claude가 작업을 마치고 멈출 때 1회 실행해
 * git 워킹트리에서 변경된 TS/JS 파일에만 prettier --write + eslint --fix 를 적용한다.
 *
 * 실패해도 흐름을 막지 않도록 항상 0으로 종료한다.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

function changedFiles() {
  const out = [
    git(['diff', '--name-only', '--diff-filter=ACMR']),
    git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']),
    git(['ls-files', '--others', '--exclude-standard']),
  ].join('\n');

  return [
    ...new Set(
      out
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ]
    .filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f))
    .filter((f) => existsSync(f));
}

const files = changedFiles();
if (files.length === 0) process.exit(0);

const run = (args) => {
  try {
    execFileSync('pnpm', args, { stdio: 'ignore' });
  } catch {
    // 포맷/린트 실패는 무시 (흐름 비차단)
  }
};

run(['exec', 'prettier', '--write', ...files]);
run(['exec', 'eslint', '--fix', ...files]);
