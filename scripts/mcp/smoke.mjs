#!/usr/bin/env node
/**
 * guards MCP 서버 스모크 테스트 — 실제 stdio 전송으로 전 도구를 1회씩 호출한다.
 *
 * jest 대신 별도 스크립트인 이유: scripts/는 zero-build ESM(.mjs)이고 jest 파이프라인은
 * SWC/CJS 기준이라, 테스트를 위해 빌드 체인을 늘리는 대신 실 전송 경로를 그대로 검증한다.
 * CI에서 `pnpm mcp:smoke`로 실행 — 어떤 도구든 isError면 종료코드 1.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const client = new Client({ name: 'guards-smoke', version: '0.0.0' });
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: [join(ROOT, 'scripts', 'mcp', 'server.mjs')],
    cwd: ROOT,
  }),
);

const { tools } = await client.listTools();
process.stdout.write(`도구 ${tools.length}개: ${tools.map((t) => t.name).join(', ')}\n`);

// check_migration_drift는 스테이징 기준이라 깨끗한 트리에서 ok=true가 정상.
const calls = [
  ['list_rules', { prefix: 'AC' }],
  ['list_rules', { enforcement: 'review-only' }],
  ['get_rule', { id: 'LAYER-004' }],
  ['get_convention', { doc: '04' }],
  ['check_doc_refs', {}],
  ['check_registry_drift', {}],
  ['check_migration_drift', {}],
  ['check_architecture', {}],
];

let failed = 0;
for (const [name, args] of calls) {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content?.[0]?.text ?? '';
  let summary = '';
  try {
    const payload = JSON.parse(text);
    summary =
      payload.count !== undefined
        ? `count=${payload.count}`
        : payload.violations !== undefined
          ? `violations=${payload.violations.length}`
          : payload.rule
            ? `rule=${payload.rule.id}`
            : payload.file
              ? `file=${payload.file} (${payload.content.length}B)`
              : (payload.output ?? '').split('\n')[0];
    if (res.isError || payload.ok === false) failed += 1;
  } catch {
    failed += 1;
    summary = '(JSON 아님)';
  }
  process.stdout.write(`${res.isError ? '✖' : '✓'} ${name}(${JSON.stringify(args)}) → ${summary}\n`);
}

await client.close();
process.stdout.write(failed === 0 ? '\n스모크 통과\n' : `\n실패 ${failed}건\n`);
process.exit(failed === 0 ? 0 : 1);
