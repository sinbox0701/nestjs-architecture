#!/usr/bin/env node
/**
 * 룰 레지스트리 ↔ 강제 설정 드리프트 가드.
 *
 * docs/convention/rules.yml 은 "모든 룰은 자기 강제 수단을 선언한다"가 계약이다.
 * 이 가드는 그 선언이 거짓말이 되는 순간을 잡는다:
 *   - enforcement.ref 가 가리키는 depcruise forbidden 룰이 .dependency-cruiser.cjs 에서 삭제/개명됨
 *   - eslint ref 가 eslint.config.mjs 에 더 이상 없음
 *   - script ref 가 scripts/ 에 없음
 *   - doc 이 가리키는 컨벤션 문서가 없음 (리넘버링 등)
 *   - id 중복 / 필수 필드 누락 / enforcement.type 오타
 *
 * 모드:
 *   (기본)   드리프트가 있으면 종료코드 1. CI 게이트용.
 *   --warn   드리프트가 있어도 0 (비차단 경고).
 *
 * 사용: node scripts/check-registry-drift.mjs [--warn]  (또는 pnpm rules:check)
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { loadRules, refsOf, docFileOf, ENFORCEMENT_TYPES, REGISTRY_PATH } from './mcp/lib/registry.mjs';

const warnOnly = process.argv.slice(2).includes('--warn');
const ROOT = process.cwd();
const problems = [];

let rules;
try {
  rules = loadRules(ROOT);
} catch (e) {
  process.stderr.write(`\x1b[31m✖ 실패\x1b[0m ${REGISTRY_PATH} 파싱 불가: ${e.message}\n`);
  process.exit(1);
}

// 대조 소스 로드
const require = createRequire(import.meta.url);
const depcruiseNames = new Set((require(join(ROOT, '.dependency-cruiser.cjs')).forbidden ?? []).map((r) => r.name));
const eslintConfigText = readFileSync(join(ROOT, 'eslint.config.mjs'), 'utf8');

// 룰별 검증
const seen = new Set();
for (const rule of rules) {
  const at = rule?.id ?? '(id 없음)';
  if (!rule?.id || !rule?.statement || !rule?.severity || !rule?.enforcement?.type || !rule?.doc) {
    problems.push(`${at}: 필수 필드 누락 (id/statement/severity/enforcement.type/doc)`);
    continue;
  }
  if (seen.has(rule.id)) problems.push(`${at}: id 중복`);
  seen.add(rule.id);

  if (!ENFORCEMENT_TYPES.includes(rule.enforcement.type)) {
    problems.push(`${at}: 알 수 없는 enforcement.type '${rule.enforcement.type}'`);
  }

  const refs = refsOf(rule);
  if (rule.enforcement.type === 'review-only' && refs.length > 0) {
    problems.push(`${at}: review-only 인데 ref가 있음 — 기계 강제로 승격했으면 type을 바꿔라`);
  }
  if (rule.enforcement.type !== 'review-only' && refs.length === 0) {
    problems.push(`${at}: enforcement.type=${rule.enforcement.type} 인데 ref 없음`);
  }

  for (const ref of refs) {
    if (rule.enforcement.type === 'depcruise' && !depcruiseNames.has(ref)) {
      problems.push(`${at}: depcruise 룰 '${ref}' 이 .dependency-cruiser.cjs forbidden에 없음`);
    }
    if (rule.enforcement.type === 'eslint' && !eslintConfigText.includes(ref)) {
      problems.push(`${at}: eslint ref '${ref}' 가 eslint.config.mjs 에 없음`);
    }
    if (rule.enforcement.type === 'script' && !existsSync(join(ROOT, 'scripts', ref))) {
      problems.push(`${at}: script '${ref}' 가 scripts/ 에 없음`);
    }
  }

  const docFile = docFileOf(rule);
  if (!existsSync(join(ROOT, 'docs', 'convention', docFile))) {
    problems.push(`${at}: doc '${docFile}' 이 docs/convention/ 에 없음`);
  }
}

if (problems.length === 0) {
  process.stdout.write(`\x1b[32m✓\x1b[0m 룰 레지스트리 정합성 OK (${rules.length}개 룰)\n`);
  process.exit(0);
}

const label = warnOnly ? '\x1b[33m⚠ 경고\x1b[0m' : '\x1b[31m✖ 실패\x1b[0m';
process.stderr.write(
  `\n${label} 룰 레지스트리 드리프트 ${problems.length}건:\n` +
    problems.map((p) => `    - ${p}`).join('\n') +
    `\n\n  ${REGISTRY_PATH} 또는 해당 설정을 함께 갱신하세요.\n\n`,
);
process.exit(warnOnly ? 0 : 1);
