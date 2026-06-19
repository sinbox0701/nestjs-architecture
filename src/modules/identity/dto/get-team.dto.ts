import { IntersectionType } from '@nestjs/swagger';

import { KeywordQuery, OffsetPageQuery } from '@/common/base/dto';

/** 소속팀 응답 형태. */
export class TeamData {
  /** 소속팀 ID */
  id!: number;
  /** 이름 */
  name!: string;
  /** 상위 역할 ID */
  roleId!: number;
}

/** 소속팀 목록 조회. */
export class GetTeamListRequest extends IntersectionType(OffsetPageQuery, KeywordQuery) {}
