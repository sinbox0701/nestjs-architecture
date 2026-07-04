/**
 * 자식 프로세스 실행 헬퍼 — MCP 도구가 기존 가드(depcruise, scripts/*.mjs)를 래핑할 때 쓴다.
 *
 * 규율:
 *   - shell을 거치지 않는다(execFile) — 도구 입력이 셸 인젝션 표면이 되지 않게.
 *   - 타임아웃·출력 상한을 강제한다 — 에이전트 호출이 서버를 물고 늘어지지 않게.
 *   - 예외 대신 envelope을 반환한다 — { exitCode, stdout, stderr, timedOut }.
 *     가드 스크립트는 "위반 발견 = exit 1"이 정상 동작이므로 비-0 종료를 에러로 취급하지 않는다.
 */
import { execFile } from 'node:child_process';

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;

export function run(command, args, { cwd = process.cwd(), timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { cwd, timeout: timeoutMs, maxBuffer: MAX_OUTPUT_BYTES, encoding: 'utf8' },
      (error, stdout, stderr) => {
        resolve({
          exitCode: error ? (error.code ?? 1) : 0,
          timedOut: Boolean(error?.killed),
          stdout: stdout ?? '',
          stderr: stderr ?? '',
        });
      },
    );
  });
}
