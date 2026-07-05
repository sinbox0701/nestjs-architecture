#!/usr/bin/env node
/**
 * review_diff 품질 측정 — 위반을 심은 diff와 클린 diff 픽스처로 precision/recall을 잰다.
 *
 * "LLM이 심사한다"는 주장을 측정으로 바꾸는 하네스다. 실행에는 ANTHROPIC_API_KEY가 필요하다
 * (스킵 경로 검증은 mcp:smoke가 담당). CI 게이트가 아니라 프롬프트·룰 문구를 고칠 때
 * 회귀를 재는 용도라, 결과는 리포트만 하고 항상 exit 0 한다.
 *
 * 채점: 픽스처별 예측 룰 ID 집합 vs cases.yml의 expect/accept.
 *   TP = 예측 ∩ expect / FN = expect − 예측 / FP = 예측 − expect − accept
 *   confidence=low 예측을 포함/제외한 두 기준으로 집계한다 — low가 오탐 완충으로
 *   작동하는지(제외 시 precision 상승) 보기 위해서다.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

import { hasApiKey, reviewDiffCore, LLM_MODEL } from './lib/llm.mjs';
import { loadRules } from './lib/registry.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const EVAL_DIR = join(ROOT, 'scripts', 'mcp', 'eval');
const CONCURRENCY = 3;

if (!hasApiKey()) {
  process.stderr.write('ANTHROPIC_API_KEY가 없어 eval을 실행할 수 없습니다.\n');
  process.exit(1);
}

const { cases } = parse(readFileSync(join(EVAL_DIR, 'cases.yml'), 'utf8'));
const reviewOnlyRules = loadRules(ROOT).filter((r) => r.enforcement?.type === 'review-only');
process.stdout.write(`모델 ${LLM_MODEL} · 픽스처 ${cases.length}개 · 심사 룰 ${reviewOnlyRules.length}개\n\n`);

// 단순 워커 풀 — 픽스처 순서와 무관하게 CONCURRENCY개씩 심사한다.
const queue = cases.map((c, i) => ({ ...c, i }));
const results = new Array(cases.length);
let totalTokens = { input: 0, output: 0 };
const startedAt = Date.now();

async function worker() {
  for (;;) {
    const item = queue.shift();
    if (!item) return;
    const diff = readFileSync(join(EVAL_DIR, 'fixtures', item.fixture), 'utf8');
    try {
      const r = await reviewDiffCore({ diff, rules: reviewOnlyRules });
      totalTokens.input += r.usage?.input_tokens ?? 0;
      totalTokens.output += r.usage?.output_tokens ?? 0;
      results[item.i] = { ...item, findings: r.findings, ungrounded: r.ungrounded };
    } catch (error) {
      results[item.i] = { ...item, error: error.message };
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// ── 채점 ──────────────────────────────────────────────────────────────────────

function score(includeLow) {
  const agg = { tp: 0, fp: 0, fn: 0 };
  const rows = [];
  for (const r of results) {
    if (r.error) {
      rows.push(`✖ ${r.fixture} — 호출 실패: ${r.error}`);
      continue;
    }
    const predicted = new Set(
      r.findings.filter((f) => includeLow || f.confidence === 'high').map((f) => f.ruleId),
    );
    const expect = new Set(r.expect ?? []);
    const accept = new Set(r.accept ?? []);
    const tp = [...predicted].filter((id) => expect.has(id));
    const fn = [...expect].filter((id) => !predicted.has(id));
    const fp = [...predicted].filter((id) => !expect.has(id) && !accept.has(id));
    agg.tp += tp.length;
    agg.fp += fp.length;
    agg.fn += fn.length;
    const mark = fn.length === 0 && fp.length === 0 ? '✓' : '✖';
    const detail = [
      tp.length ? `잡음: ${tp.join(',')}` : expect.size === 0 ? '클린 판정' : null,
      fn.length ? `놓침: ${fn.join(',')}` : null,
      fp.length ? `오탐: ${fp.join(',')}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    rows.push(`${mark} ${r.fixture} — ${detail}`);
  }
  const precision = agg.tp + agg.fp === 0 ? 1 : agg.tp / (agg.tp + agg.fp);
  const recall = agg.tp + agg.fn === 0 ? 1 : agg.tp / (agg.tp + agg.fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { rows, agg, precision, recall, f1 };
}

const strict = score(false); // high만 예측으로 인정
const lenient = score(true); // low 포함

process.stdout.write(strict.rows.join('\n') + '\n\n');
const pct = (n) => `${(n * 100).toFixed(0)}%`;
process.stdout.write(
  [
    `high만   → precision ${pct(strict.precision)} · recall ${pct(strict.recall)} · F1 ${pct(strict.f1)} (TP ${strict.agg.tp} / FP ${strict.agg.fp} / FN ${strict.agg.fn})`,
    `low 포함 → precision ${pct(lenient.precision)} · recall ${pct(lenient.recall)} · F1 ${pct(lenient.f1)} (TP ${lenient.agg.tp} / FP ${lenient.agg.fp} / FN ${lenient.agg.fn})`,
    `토큰 in ${totalTokens.input} / out ${totalTokens.output} · ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
  ].join('\n') + '\n',
);

const ungroundedTotal = results.reduce((n, r) => n + (r.ungrounded?.length ?? 0), 0);
if (ungroundedTotal > 0) {
  process.stdout.write(`⚠ ungrounded finding ${ungroundedTotal}건 — 모델이 레지스트리 밖 룰 ID를 지어냄\n`);
}
