#!/usr/bin/env node
/**
 * 엔티티 ↔ 마이그레이션 드리프트 가드.
 *
 * `*.entity.ts`가 변경됐는데 `migrations/`에 새 마이그레이션이 없으면 알린다.
 * "마이그레이션 깜빡"을 방지한다.
 *
 * 모드:
 *   (기본) staged   — pre-commit: 스테이징된 파일 비교
 *   --base <ref>     — CI: <ref>...HEAD 범위 비교 (예: origin/main)
 *   --warn           — 드리프트가 있어도 종료코드 0 (비차단 경고). 미지정 시 1로 실패.
 *
 * dev 반복은 schema:update로 충분하므로 pre-commit은 --warn(비차단)으로 쓴다.
 * 머지 게이트(CI)는 --base로 강제 실패시킨다.
 */
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const warnOnly = args.includes('--warn');
const baseIdx = args.indexOf('--base');
const base = baseIdx !== -1 ? args[baseIdx + 1] : null;

function changedFiles() {
  const cmd = base
    ? `git diff --name-only --diff-filter=ACMR ${base}...HEAD`
    : `git diff --cached --name-only --diff-filter=ACMR`;
  return execSync(cmd, { encoding: 'utf8' })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

const files = changedFiles();
const entities = files.filter((f) => /\.entity\.ts$/.test(f));
const migrations = files.filter((f) => /^migrations\/.+\.(ts|js)$/.test(f));

if (entities.length === 0 || migrations.length > 0) {
  process.exit(0);
}

const label = warnOnly ? '\x1b[33m⚠ 경고\x1b[0m' : '\x1b[31m✖ 실패\x1b[0m';
process.stderr.write(
  `\n${label} 엔티티가 변경됐지만 새 마이그레이션이 없습니다.\n` +
    entities.map((e) => `    - ${e}`).join('\n') +
    `\n\n  마이그레이션을 생성하세요:\n` +
    `    /migration                   # (권장) 엔티티 diff 분석 → 마이그레이션 생성 스킬\n` +
    `    pnpm migration:create        # 또는 MikroORM CLI로 직접 생성\n` +
    `    pnpm migration:verify        # (선택) Docker dry-run 검증\n` +
    (warnOnly
      ? `\n  dev 반복 중이라 의도적으로 미룬 거면 무시해도 됩니다 (커밋은 진행됨).\n\n`
      : `\n  의도적으로 건너뛰려면 이 단계를 제외하세요.\n\n`),
);

process.exit(warnOnly ? 0 : 1);
