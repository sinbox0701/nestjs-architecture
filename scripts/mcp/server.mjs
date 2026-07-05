#!/usr/bin/env node
/**
 * guards — 이 레포의 컨벤션·아키텍처 검증기를 AI 에이전트에게 노출하는 MCP 서버 (stdio).
 *
 * 목적: 리뷰 서브에이전트가 컨벤션을 grep/추측으로 해석하지 않고, 룰 레지스트리
 * (docs/convention/rules.yml)와 실제 가드(depcruise, scripts/*.mjs)를 표준 인터페이스로
 * 호출해 근거(룰 ID + 문서)를 인용하게 한다.
 *
 * 설계 규율:
 *   - read-only by design: 노출 도구는 전부 조회/검사. 파일·DB를 변경하는 도구는 두지 않는다.
 *   - 검증 로직 재구현 금지: 기존 가드를 자식 프로세스로 래핑만 한다(단일 진실 소스 유지).
 *   - 입력은 zod로 검증하고, 파일 조회는 docs/convention/ 밖을 가리킬 수 없다(경로 이탈 차단).
 *   - 응답은 envelope(JSON text)로: { ok, ... } — 위반 발견은 에러가 아니라 정상 결과다.
 *   - 결정적/비결정적 계층 분리: eslint·depcruise·script로 잡히는 룰은 check_*가 처리하고,
 *     LLM(review_diff)은 enforcement=review-only 층만 심사한다(lib/llm.mjs 참조).
 *
 * 등록: .mcp.json (템플릿: .mcp.json.example) → 실행: pnpm mcp:serve (stdio, 단독 실행 시 입력 대기)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { run } from './lib/exec.mjs';
import { hasApiKey, reviewDiffCore, LLM_MODEL } from './lib/llm.mjs';
import { loadRules, refsOf, depcruiseRefIndex, REGISTRY_PATH } from './lib/registry.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONVENTION_DIR = join(ROOT, 'docs', 'convention');

const server = new McpServer({ name: 'guards', version: '0.1.0' });

const json = (payload) => ({ content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] });
const fail = (message) => ({
  isError: true,
  content: [{ type: 'text', text: JSON.stringify({ ok: false, error: message }) }],
});

// ── 레지스트리 조회 ──────────────────────────────────────────────────────────

server.registerTool(
  'list_rules',
  {
    title: '컨벤션 룰 목록',
    description:
      `룰 레지스트리(${REGISTRY_PATH})의 규범 조항 목록. ` +
      'enforcement=review-only 필터가 곧 "기계가 못 잡아 리뷰가 봐야 하는" 체크리스트다.',
    inputSchema: {
      prefix: z
        .string()
        .regex(/^[A-Z]{2,8}$/)
        .optional()
        .describe('룰 ID 접두사 필터 (MOD|LAYER|AC|QRY)'),
      enforcement: z.enum(['eslint', 'depcruise', 'script', 'hook', 'review-only']).optional(),
    },
  },
  async ({ prefix, enforcement }) => {
    const rules = loadRules(ROOT)
      .filter((r) => !prefix || r.id.startsWith(`${prefix}-`))
      .filter((r) => !enforcement || r.enforcement?.type === enforcement)
      .map((r) => ({ id: r.id, severity: r.severity, enforcement: r.enforcement?.type, statement: r.statement }));
    return json({ ok: true, count: rules.length, rules });
  },
);

server.registerTool(
  'get_rule',
  {
    title: '컨벤션 룰 상세',
    description:
      '룰 ID로 규범 조항 전체(강제 수단, 근거 문서 앵커 포함)를 조회한다. 리뷰 코멘트에 이 ID와 doc을 인용하라.',
    inputSchema: {
      id: z
        .string()
        .regex(/^[A-Z]{2,8}-\d{3}$/)
        .describe('예: LAYER-004'),
    },
  },
  async ({ id }) => {
    const rule = loadRules(ROOT).find((r) => r.id === id);
    return rule ? json({ ok: true, rule }) : fail(`룰 없음: ${id}`);
  },
);

server.registerTool(
  'get_convention',
  {
    title: '컨벤션 문서 본문',
    description:
      '룰의 "왜"가 필요할 때 docs/convention/ 문서 원문을 조회한다. doc은 "04" 또는 "04-layer-responsibility.md" 형식.',
    inputSchema: {
      doc: z
        .string()
        .regex(/^(README|\d{2})(-[a-z0-9-]+)?(\.md)?$/)
        .describe('문서 번호·이름 (경로 불가)'),
    },
  },
  async ({ doc }) => {
    // 정규식이 경로 구분자를 차단하지만, 최종 접근은 실제 디렉토리 목록과 대조해 한 번 더 막는다.
    const files = readdirSync(CONVENTION_DIR).filter((f) => f.endsWith('.md'));
    const want = doc.replace(/\.md$/, '');
    const match = files.find((f) => f === `${want}.md` || f.startsWith(`${want}-`) || f.replace(/\.md$/, '') === want);
    if (!match) return fail(`문서 없음: ${doc} (보유: ${files.join(', ')})`);
    return json({ ok: true, file: match, content: readFileSync(join(CONVENTION_DIR, match), 'utf8') });
  },
);

// ── 검증기 래핑 (기존 가드 재사용) ────────────────────────────────────────────

server.registerTool(
  'check_architecture',
  {
    title: '아키텍처 경계 검사 (dependency-cruiser)',
    description: '레이어 역의존·모듈 내부 침투·순환을 검사하고, 위반을 레지스트리 룰 ID로 주석해 반환한다.',
    inputSchema: {},
  },
  async () => {
    const r = await run(
      join(ROOT, 'node_modules', '.bin', 'depcruise'),
      ['src', '--config', '.dependency-cruiser.cjs', '--output-type', 'json'],
      { cwd: ROOT },
    );
    if (r.timedOut) return fail('depcruise 타임아웃');
    let report;
    try {
      report = JSON.parse(r.stdout);
    } catch {
      return fail(`depcruise 출력 파싱 실패: ${r.stderr.slice(0, 500)}`);
    }
    const refIndex = depcruiseRefIndex(loadRules(ROOT));
    const violations = (report.summary?.violations ?? []).map((v) => ({
      rule: v.rule?.name,
      ruleIds: refIndex.get(v.rule?.name) ?? [],
      severity: v.rule?.severity,
      from: v.from,
      to: v.to,
    }));
    return json({ ok: violations.length === 0, violations });
  },
);

server.registerTool(
  'check_doc_refs',
  {
    title: '컨벤션 문서 참조 정합성',
    description:
      '코드·문서에 하드코딩된 NN-slug.md 참조가 실제 문서 번호와 일치하는지 검사한다 (scripts/check-doc-refs.mjs 래핑).',
    inputSchema: {},
  },
  async () => {
    const r = await run('node', ['scripts/check-doc-refs.mjs'], { cwd: ROOT });
    return json({ ok: r.exitCode === 0, output: (r.stdout + r.stderr).trim() });
  },
);

server.registerTool(
  'check_migration_drift',
  {
    title: '엔티티↔마이그레이션 드리프트',
    description:
      '엔티티가 변경됐는데 새 마이그레이션이 없는 커밋 범위를 잡아낸다 (scripts/check-entity-migration.mjs 래핑). base 미지정 시 스테이징 기준.',
    inputSchema: {
      base: z
        .string()
        .regex(/^[\w./-]{1,100}$/)
        .optional()
        .describe('비교 기준 ref (예: origin/main)'),
    },
  },
  async ({ base }) => {
    const r = await run('node', ['scripts/check-entity-migration.mjs', ...(base ? ['--base', base] : [])], {
      cwd: ROOT,
    });
    return json({ ok: r.exitCode === 0, output: (r.stdout + r.stderr).trim() || '드리프트 없음' });
  },
);

server.registerTool(
  'check_registry_drift',
  {
    title: '룰 레지스트리↔설정 드리프트',
    description: `${REGISTRY_PATH}의 enforcement ref가 실제 eslint/dep-cruiser 설정·스크립트에 존재하는지 검사한다 (scripts/check-registry-drift.mjs 래핑).`,
    inputSchema: {},
  },
  async () => {
    const r = await run('node', ['scripts/check-registry-drift.mjs'], { cwd: ROOT });
    return json({ ok: r.exitCode === 0, output: (r.stdout + r.stderr).trim() });
  },
);

// ── LLM 심사 (review-only 층 전용) ────────────────────────────────────────────

server.registerTool(
  'review_diff',
  {
    title: 'LLM 컨벤션 심사 (review-only 룰)',
    description:
      '기계 강제가 불가능한 룰(enforcement=review-only)에 대해 git diff를 Claude API로 심사한다. ' +
      '모든 finding은 룰 ID에 귀속되며, 레지스트리에 없는 ID는 ungrounded로 격리된다. ' +
      'ANTHROPIC_API_KEY가 없으면 호출 없이 skipped를 반환한다(결정적 check_* 도구는 영향 없음).',
    inputSchema: {
      base: z
        .string()
        .regex(/^[\w./-]{1,100}$/)
        .optional()
        .describe('비교 기준 ref (예: origin/main). 미지정 시 스테이징(diff --cached) 기준.'),
      prefix: z
        .string()
        .regex(/^[A-Z]{2,8}$/)
        .optional()
        .describe('심사 룰 접두사 제한 (MOD|LAYER|AC|QRY) — 토큰 절약용'),
    },
  },
  async ({ base, prefix }) => {
    if (!hasApiKey()) {
      return json({ ok: false, skipped: true, reason: 'ANTHROPIC_API_KEY 미설정 — review_diff만 스킵됨' });
    }
    const diffArgs = base ? ['diff', `${base}...HEAD`, '--unified=3'] : ['diff', '--cached', '--unified=3'];
    const r = await run('git', [...diffArgs, '--', 'src', 'tests'], { cwd: ROOT });
    if (r.exitCode !== 0) return fail(`git diff 실패: ${r.stderr.slice(0, 300)}`);

    const rules = loadRules(ROOT)
      .filter((rule) => rule.enforcement?.type === 'review-only')
      .filter((rule) => !prefix || rule.id.startsWith(`${prefix}-`));
    try {
      const result = await reviewDiffCore({ diff: r.stdout, rules });
      return json({ ok: result.findings.length === 0, ...result });
    } catch (error) {
      return fail(`LLM 심사 실패: ${error.message}`);
    }
  },
);

await server.connect(new StdioServerTransport());
