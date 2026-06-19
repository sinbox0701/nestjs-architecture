import { HttpStatus } from '@nestjs/common';

import { HttpException } from '@/common/exceptions';

/** 역할 도메인 예외 팩토리. */
export const ROLE_EXCEPTIONS = {
  NOT_FOUND: () => new HttpException('ROLE_NOT_FOUND', '역할을 찾을 수 없습니다.', HttpStatus.NOT_FOUND),
  NAME_DUPLICATED: () =>
    new HttpException('ROLE_NAME_DUPLICATED', '이미 사용 중인 역할 이름입니다.', HttpStatus.CONFLICT),
  HAS_TEAMS: () => new HttpException('ROLE_HAS_TEAMS', '소속팀이 있는 역할은 삭제할 수 없습니다.', HttpStatus.CONFLICT),
};
