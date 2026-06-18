import { HttpStatus } from '@nestjs/common';

import { HttpException } from '@/common/exceptions';

/**
 * 인증 도메인 예외 팩토리. 인라인 예외 대신 이 상수를 던진다 (CLAUDE.md #3).
 * 코드는 `AUTH_*`로 네임스페이싱한다.
 */
export const AUTH_EXCEPTIONS = {
  INVALID_CREDENTIALS: () =>
    new HttpException('AUTH_INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.', HttpStatus.UNAUTHORIZED),
  INVALID_REFRESH_TOKEN: () =>
    new HttpException(
      'AUTH_INVALID_REFRESH_TOKEN',
      '유효하지 않은 refresh token입니다. 다시 로그인해주세요.',
      HttpStatus.UNAUTHORIZED,
    ),
  REFRESH_TOKEN_REUSED: () =>
    new HttpException(
      'AUTH_REFRESH_TOKEN_REUSED',
      '재사용된 refresh token이 감지되어 세션을 무효화했습니다. 다시 로그인해주세요.',
      HttpStatus.UNAUTHORIZED,
    ),
};
