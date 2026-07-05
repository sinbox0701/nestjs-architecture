/**
 * LLM 리뷰 코어 — 기계 강제가 불가능한 룰(enforcement=review-only)을 Claude API로 심사한다.
 *
 * 계층 규율(중요): eslint/depcruise/script/hook으로 잡히는 룰은 여기로 보내지 않는다.
 * 결정적 검사가 원리적으로 불가능한 층만 LLM이 심사하고, 그 대신 출력을 강제한다:
 *   - tool_use 강제(structured output) — 자유 산문 금지, 스키마 밖 출력은 성립 불가.
 *   - 모든 finding은 ruleId 귀속 — 전달한 룰 목록에 없는 ID는 서버가 걸러 ungrounded로 격리한다
 *     (프롬프트 지시가 아니라 코드가 근거를 강제한다).
 *   - temperature 0 — 심사 재현성을 모델이 허용하는 한도까지 끌어올린다.
 *
 * ANTHROPIC_API_KEY가 없으면 호출 없이 스킵 신호를 반환한다 — CI(mcp:smoke)는 시크릿 없이 그린.
 */
import Anthropic from '@anthropic-ai/sdk';

export const LLM_MODEL = process.env.GUARDS_LLM_MODEL ?? 'claude-sonnet-5';
const TIMEOUT_MS = 120_000;
const MAX_DIFF_CHARS = 120_000; // 이걸 넘는 diff는 심사 품질이 무너진다 — 쪼개서 호출하게 실패시킨다.
const MAX_OUTPUT_TOKENS = 8_192;

export function hasApiKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const FINDINGS_TOOL = {
  name: 'report_findings',
  description: '컨벤션 심사 결과 보고. 위반이 없으면 findings를 빈 배열로 보고한다.',
  input_schema: {
    type: 'object',
    properties: {
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ruleId: { type: 'string', description: '위반한 룰 ID (전달된 룰 목록에 있는 것만)' },
            file: { type: 'string', description: 'diff 헤더 기준 파일 경로' },
            line: { type: 'integer', description: '변경 후 파일 기준 대략의 라인 번호' },
            evidence: { type: 'string', description: 'diff에서 그대로 인용한 위반 코드 (요약·의역 금지)' },
            reason: { type: 'string', description: '왜 이 룰 위반인지 한두 문장' },
            confidence: { type: 'string', enum: ['high', 'low'] },
          },
          required: ['ruleId', 'file', 'evidence', 'reason', 'confidence'],
        },
      },
    },
    required: ['findings'],
  },
};

function buildPrompt(diff, rules) {
  const ruleLines = rules
    .map((r) => `- ${r.id} [${r.severity}] ${r.statement}`)
    .join('\n');
  return [
    '너는 이 NestJS 레포의 컨벤션 심사자다. 아래 diff를 아래 룰 목록에 대해서만 심사하라.',
    '',
    '심사 규칙:',
    '- 룰 목록에 없는 관점(취향, 일반 모범사례, 성능 등)으로 지적하지 마라.',
    '- diff에 실제로 보이는 코드만 근거로 삼아라. evidence는 diff에서 그대로 인용하라.',
    '- 위반이라고 단정하기 애매하면 confidence를 low로 보고하라. 확신 없는 지적을 지어내지 마라.',
    '- 위반이 없으면 findings를 빈 배열로 보고하라 — 억지로 찾지 마라.',
    '- 삭제된 라인(-)은 위반 근거가 아니다. 추가/변경된 라인(+)만 심사하라.',
    '',
    '## 심사 대상 룰 (전체 레지스트리 중 review-only 층)',
    ruleLines,
    '',
    '## diff',
    '```diff',
    diff,
    '```',
  ].join('\n');
}

/**
 * review-only 룰 목록으로 diff를 심사한다.
 * @returns {Promise<{findings: object[], ungrounded: object[], model: string, usage: object}>}
 * @throws API 키 없음/diff 초과는 호출 전에 Error로 던진다 — 소비자(도구/eval)가 envelope로 감싼다.
 */
export async function reviewDiffCore({ diff, rules }) {
  if (!hasApiKey()) throw new Error('no_api_key');
  if (!diff.trim()) return { findings: [], ungrounded: [], model: LLM_MODEL, usage: null };
  if (diff.length > MAX_DIFF_CHARS) {
    throw new Error(`diff가 ${MAX_DIFF_CHARS}자를 초과했습니다(${diff.length}자) — base를 좁혀 나눠 호출하세요.`);
  }

  const client = new Anthropic({ timeout: TIMEOUT_MS });
  const response = await client.messages.create({
    model: LLM_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0,
    tools: [FINDINGS_TOOL],
    tool_choice: { type: 'tool', name: 'report_findings' },
    messages: [{ role: 'user', content: buildPrompt(diff, rules) }],
  });

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  const reported = Array.isArray(toolUse?.input?.findings) ? toolUse.input.findings : [];

  // 근거 강제: 전달한 룰 목록에 없는 ruleId는 finding으로 인정하지 않는다.
  const knownIds = new Set(rules.map((r) => r.id));
  const findings = [];
  const ungrounded = [];
  for (const f of reported) (knownIds.has(f.ruleId) ? findings : ungrounded).push(f);

  return {
    findings,
    ungrounded,
    model: LLM_MODEL,
    usage: { input_tokens: response.usage?.input_tokens, output_tokens: response.usage?.output_tokens },
  };
}
