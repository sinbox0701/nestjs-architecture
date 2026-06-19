import { Ref, ref } from '@mikro-orm/core';
import { Entity, Index, ManyToOne, Property } from '@mikro-orm/decorators/legacy';

import { BaseEntity } from '@/common/base/base.entity';

import { Role } from './role.entity';

/**
 * 소속팀. 역할(Role) 아래에 생성되며, 자원을 점유(소유)한다 → Tier2 ABAC의 소유 단위.
 */
@Entity()
// name unique는 partial index(soft-delete 후 동명 재생성 허용). 서비스 레벨 중복검사의 DB 보강.
@Index({
  name: 'teams_name_active_uq',
  expression: 'create unique index if not exists "teams_name_active_uq" on "teams" ("name") where "deleted_at" is null',
})
export class Team extends BaseEntity {
  @Property({ type: 'varchar', length: 100 })
  name!: string;

  // FK 컬럼은 인덱스 필수(11-query-strategy): JOIN seq scan + 부모 삭제 시 자식 풀스캔/락 방지.
  @ManyToOne(() => Role, { ref: true, index: true })
  role!: Ref<Role>;

  static create(name: string, role: Role): Team {
    const team = new Team();
    team.name = name;
    team.role = ref(role);
    return team;
  }

  rename(name: string): void {
    this.name = name;
  }
}
