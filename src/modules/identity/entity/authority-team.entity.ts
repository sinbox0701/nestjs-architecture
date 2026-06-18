import { Entity, Property } from '@mikro-orm/decorators/legacy';

import { BaseEntity } from '@/common/base/base.entity';

/**
 * 권한팀 (Red/Blue…). 색으로 구분되는 **플랫폼 capability 그룹**.
 * 어떤 resourceType에 어떤 액션이 가능한지(Tier1 RBAC)를 결정한다. 소속팀(Team)은 이 아래에 생긴다.
 */
@Entity()
export class AuthorityTeam extends BaseEntity {
  @Property({ type: 'varchar', length: 50, unique: true })
  name!: string; // 예: "Blue Team"

  @Property({ type: 'varchar', length: 20 })
  color!: string; // 예: "BLUE" — Tier1 매트릭스 키

  static create(name: string, color: string): AuthorityTeam {
    const team = new AuthorityTeam();
    team.name = name;
    team.color = color;
    return team;
  }

  rename(name: string): void {
    this.name = name;
  }

  changeColor(color: string): void {
    this.color = color;
  }
}
