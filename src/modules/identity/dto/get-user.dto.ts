import { IntersectionType } from '@nestjs/swagger';

import { KeywordQuery, OffsetPageQuery } from '@/common/base/dto';

import { TeamPosition } from '../enum/team-position.enum';

/** 사용자 응답 표준 형태. */
export class UserData {
  /** 사용자 ID */
  id!: number;
  /** 이메일 */
  email!: string;
  /** 이름 */
  name!: string;
  /** 소속팀 ID */
  teamId!: number;
  /** 소속팀 내 직위 */
  position!: TeamPosition;
}

/** 사용자 목록 조회 (offset 페이지네이션 + 키워드 검색). */
export class GetUserListRequest extends IntersectionType(OffsetPageQuery, KeywordQuery) {}
