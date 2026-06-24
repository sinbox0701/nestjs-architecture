#!/usr/bin/env node
/**
 * .claude/config.json 정합성 가드.
 *
 * SDD 스킬(spec/issues/fe-changes/status)은 Linear teamId·FE 레포 경로 등을 이 파일에서 읽는다.
 * 파일이 깨졌거나(JSON parse 실패) 기대 키의 타입이 틀리면 스킬 실행 도중에 터진다.
 * 이 가드는 그 실패를 미리, 명확하게 잡는다.
 *
 * 규칙:
 *   - JSON parse 실패 → 실패(exit 1).
 *   - 기대 키 누락 또는 비-문자열 → 실패.
 *   - 빈 문자열("")은 "미설정"으로 본다 → 경고만(스킬이 사용자에게 묻는 흐름). exit 0.
 *
 * 사용: node scripts/check-config.mjs  (또는 pnpm config:check)
 */
import { readFileSync } from 'node:fs';

const CONFIG_PATH = '.claude/config.json';

// 기대 키(dot-path) — 전부 문자열이어야 한다. 빈 문자열은 "미설정"으로 허용(경고).
const EXPECTED_STRING_KEYS = [
  'linear.teamId',
  'linear.workspace',
  'linear.issuePrefix',
  'frontend.repoPath',
  'frontend.orvalCommand',
];

function get(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

let raw;
try {
  raw = readFileSync(CONFIG_PATH, 'utf8');
} catch {
  process.stderr.write(`\x1b[31m✖\x1b[0m ${CONFIG_PATH} 를 읽을 수 없습니다.\n`);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(raw);
} catch (e) {
  process.stderr.write(`\x1b[31m✖\x1b[0m ${CONFIG_PATH} JSON 파싱 실패: ${e.message}\n`);
  process.exit(1);
}

const errors = [];
const unset = [];
for (const key of EXPECTED_STRING_KEYS) {
  const value = get(config, key);
  if (value === undefined) errors.push(`${key}: 키 누락`);
  else if (typeof value !== 'string') errors.push(`${key}: 문자열이어야 함(현재 ${typeof value})`);
  else if (value.trim() === '') unset.push(key);
}

if (errors.length > 0) {
  process.stderr.write(
    `\x1b[31m✖\x1b[0m ${CONFIG_PATH} 정합성 오류:\n` + errors.map((e) => `    - ${e}`).join('\n') + '\n',
  );
  process.exit(1);
}

if (unset.length > 0) {
  process.stdout.write(
    `\x1b[33m⚠\x1b[0m ${CONFIG_PATH} 미설정 키(스킬이 실행 시 사용자에게 확인): ${unset.join(', ')}\n`,
  );
} else {
  process.stdout.write('\x1b[32m✓\x1b[0m .claude/config.json 정합성 OK\n');
}
process.exit(0);
