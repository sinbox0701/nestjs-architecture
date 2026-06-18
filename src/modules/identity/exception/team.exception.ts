import { HttpStatus } from '@nestjs/common';

import { HttpException } from '@/common/exceptions';

/** 소속팀 도메인 예외 팩토리. */
export const TEAM_EXCEPTIONS = {
  NOT_FOUND: () => new HttpException('TEAM_NOT_FOUND', '소속팀을 찾을 수 없습니다.', HttpStatus.NOT_FOUND),
  NAME_DUPLICATED: () =>
    new HttpException('TEAM_NAME_DUPLICATED', '이미 사용 중인 소속팀 이름입니다.', HttpStatus.CONFLICT),
  HAS_MEMBERS: () =>
    new HttpException('TEAM_HAS_MEMBERS', '소속 사용자가 있는 팀은 삭제할 수 없습니다.', HttpStatus.CONFLICT),
};
