import { Ref, ref } from '@mikro-orm/core';
import { Entity, ManyToOne, Property } from '@mikro-orm/decorators/legacy';

import { BaseEntity } from '@/common/base/base.entity';

import { AuthorityTeam } from './authority-team.entity';

/**
 * 소속팀. 권한팀(AuthorityTeam) 아래에 생성되며, 자원을 점유(소유)한다 → Tier2 ABAC의 소유 단위.
 */
@Entity()
export class Team extends BaseEntity {
  @Property({ type: 'varchar', length: 100 })
  name!: string;

  @ManyToOne(() => AuthorityTeam, { ref: true })
  authorityTeam!: Ref<AuthorityTeam>;

  static create(name: string, authorityTeam: AuthorityTeam): Team {
    const team = new Team();
    team.name = name;
    team.authorityTeam = ref(authorityTeam);
    return team;
  }

  rename(name: string): void {
    this.name = name;
  }
}
