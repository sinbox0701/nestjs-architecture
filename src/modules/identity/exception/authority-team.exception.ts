import { HttpStatus } from '@nestjs/common';

import { HttpException } from '@/common/exceptions';

/** 권한팀 도메인 예외 팩토리. */
export const AUTHORITY_TEAM_EXCEPTIONS = {
  NOT_FOUND: () => new HttpException('AUTHORITY_TEAM_NOT_FOUND', '권한팀을 찾을 수 없습니다.', HttpStatus.NOT_FOUND),
  NAME_DUPLICATED: () =>
    new HttpException('AUTHORITY_TEAM_NAME_DUPLICATED', '이미 사용 중인 권한팀 이름입니다.', HttpStatus.CONFLICT),
  HAS_TEAMS: () =>
    new HttpException('AUTHORITY_TEAM_HAS_TEAMS', '소속팀이 있는 권한팀은 삭제할 수 없습니다.', HttpStatus.CONFLICT),
};
