import { IntersectionType } from '@nestjs/swagger';

import { KeywordQuery, OffsetPageQuery } from '@/common/base/dto';

/** 역할 응답 형태. */
export class RoleData {
  /** 역할 ID */
  id!: number;
  /** 역할 이름(식별자 겸 Tier1 매트릭스 키) @example "BLUE" */
  name!: string;
}

/** 역할 목록 조회. */
export class GetRoleListRequest extends IntersectionType(OffsetPageQuery, KeywordQuery) {}
