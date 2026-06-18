import { HttpStatus } from '@nestjs/common';

import { HttpException } from '@/common/exceptions';

/** 사용자 도메인 예외 팩토리. 인라인 예외 대신 사용 (CLAUDE.md #3). */
export const USER_EXCEPTIONS = {
  NOT_FOUND: () => new HttpException('USER_NOT_FOUND', '사용자를 찾을 수 없습니다.', HttpStatus.NOT_FOUND),
  EMAIL_DUPLICATED: () =>
    new HttpException('USER_EMAIL_DUPLICATED', '이미 사용 중인 이메일입니다.', HttpStatus.CONFLICT),
  TEAM_NOT_FOUND: () => new HttpException('USER_TEAM_NOT_FOUND', '소속팀을 찾을 수 없습니다.', HttpStatus.NOT_FOUND),
};
