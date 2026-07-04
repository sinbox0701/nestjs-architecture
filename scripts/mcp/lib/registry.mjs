/**
 * 룰 레지스트리 로더 — docs/convention/rules.yml 의 단일 접근 경로.
 *
 * MCP 서버(list_rules/get_rule)와 드리프트 가드(check-registry-drift.mjs)가 공유한다.
 * 스키마 해석(ref 문자열|배열 정규화 등)은 전부 여기서 끝내, 소비자가 형태 분기를
 * 반복하지 않게 한다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export const REGISTRY_PATH = 'docs/convention/rules.yml';

export const ENFORCEMENT_TYPES = ['eslint', 'depcruise', 'script', 'hook', 'review-only'];

/** rules.yml을 파싱해 룰 배열을 반환한다. 파일이 없거나 깨졌으면 그대로 throw. */
export function loadRules(repoRoot = process.cwd()) {
  const raw = readFileSync(join(repoRoot, REGISTRY_PATH), 'utf8');
  const doc = parse(raw);
  if (!doc || !Array.isArray(doc.rules)) {
    throw new Error(`${REGISTRY_PATH}: 최상위 'rules' 배열이 없습니다.`);
  }
  return doc.rules;
}

/** enforcement.ref를 항상 배열로 정규화한다 (없으면 []). */
export function refsOf(rule) {
  const ref = rule?.enforcement?.ref;
  if (ref == null) return [];
  return Array.isArray(ref) ? ref : [ref];
}

/** doc 필드에서 파일명만 분리한다 ("04-x.md#anchor" → "04-x.md"). */
export function docFileOf(rule) {
  return (rule?.doc ?? '').split('#')[0];
}

/** depcruise 룰명 → 레지스트리 룰 ID 역매핑 (check_architecture 결과 주석용). */
export function depcruiseRefIndex(rules) {
  const index = new Map();
  for (const rule of rules) {
    if (rule?.enforcement?.type !== 'depcruise') continue;
    for (const ref of refsOf(rule)) {
      const list = index.get(ref) ?? [];
      list.push(rule.id);
      index.set(ref, list);
    }
  }
  return index;
}
