import { Ref, ref } from '@mikro-orm/core';
import { Entity, ManyToOne, Property } from '@mikro-orm/decorators/legacy';

import { BaseEntity } from '@/common/base/base.entity';

import { Role } from './role.entity';

/**
 * 소속팀. 역할(Role) 아래에 생성되며, 자원을 점유(소유)한다 → Tier2 ABAC의 소유 단위.
 */
@Entity()
export class Team extends BaseEntity {
  @Property({ type: 'varchar', length: 100 })
  name!: string;

  @ManyToOne(() => Role, { ref: true })
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
