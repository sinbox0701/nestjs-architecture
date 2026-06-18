import { IntersectionType } from '@nestjs/swagger';

import { KeywordQuery, OffsetPageQuery } from '@/common/base/dto';

/** 권한팀 응답 형태. */
export class AuthorityTeamData {
  /** 권한팀 ID */
  id!: number;
  /** 권한팀 이름(식별자 겸 Tier1 매트릭스 키) @example "BLUE" */
  name!: string;
}

/** 권한팀 목록 조회. */
export class GetAuthorityTeamListRequest extends IntersectionType(OffsetPageQuery, KeywordQuery) {}
