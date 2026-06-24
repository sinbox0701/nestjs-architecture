#!/usr/bin/env node
/**
 * 컨벤션 문서 참조 정합성 가드.
 *
 * `docs/convention/`의 문서는 `NN-<slug>.md`로 번호가 매겨진다. 문서를 재정렬(리넘버링)하면
 * 코드 주석·ESLint/dep-cruiser 메시지·README의 하드코딩된 `NN-<slug>.md` 참조가 stale로 남아
 * "룰 위반 시 N번 문서를 보라"는 안내가 존재하지 않는 문서를 가리키게 된다.
 *
 * 이 가드는 레포 전역(추적 파일)에서 `NN-<slug>.md` 토큰을 찾아, slug가 실제 컨벤션 문서의
 * slug와 같은데 번호가 다르면(=오번호 참조) 실패시킨다. slug가 컨벤션 문서가 아니면 무시한다
 * (false positive 최소화).
 *
 * 모드:
 *   (기본)   stale 참조가 있으면 종료코드 1로 실패. CI 게이트용.
 *   --warn   stale가 있어도 0 (비차단 경고).
 *
 * 사용: node scripts/check-doc-refs.mjs [--warn]
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const warnOnly = process.argv.slice(2).includes('--warn');
const CONVENTION_DIR = 'docs/convention';

// 1) 실제 컨벤션 문서에서 slug → 올바른 번호 맵을 만든다.
const docFile = /^(\d{2})-([a-z][a-z0-9-]*)\.md$/;
const slugToNumber = new Map();
for (const name of readdirSync(CONVENTION_DIR)) {
  const m = docFile.exec(name);
  if (m) slugToNumber.set(m[2], m[1]);
}

// 2) 추적 중인 텍스트 파일을 스캔한다(node_modules 등은 git이 이미 제외).
const tracked = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean)
  // 컨벤션 문서 자신은 제외(자기 번호를 정의하는 주체).
  .filter((f) => !f.startsWith(`${CONVENTION_DIR}/`))
  // 바이너리/락 등 무관 파일 제외.
  .filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs|md|sh|json|yml|yaml)$/.test(f));

const refToken = /(\d{2})-([a-z][a-z0-9-]*)\.md/g;
const stale = [];

for (const file of tracked) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(refToken)) {
      const [, num, slug] = m;
      const correct = slugToNumber.get(slug);
      if (correct && correct !== num) {
        stale.push({ file, line: i + 1, found: `${num}-${slug}.md`, expected: `${correct}-${slug}.md` });
      }
    }
  });
}

if (stale.length === 0) {
  process.stdout.write('\x1b[32m✓\x1b[0m 컨벤션 문서 참조 정합성 OK\n');
  process.exit(0);
}

const label = warnOnly ? '\x1b[33m⚠ 경고\x1b[0m' : '\x1b[31m✖ 실패\x1b[0m';
process.stderr.write(
  `\n${label} stale 컨벤션 문서 참조 ${stale.length}건 (번호가 어긋남):\n` +
    stale.map((s) => `    - ${s.file}:${s.line}  ${s.found} → ${s.expected}`).join('\n') +
    `\n\n  문서 번호를 바꿨다면 위 참조를 함께 갱신하세요.\n\n`,
);

process.exit(warnOnly ? 0 : 1);
