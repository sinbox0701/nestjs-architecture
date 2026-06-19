import { Entity, Property } from '@mikro-orm/decorators/legacy';

import { BaseEntity } from '@/common/base/base.entity';

/**
 * 역할 (Red/Blue…). 색으로 구분되는 **플랫폼 capability 그룹**.
 * `name`(예: "BLUE")이 식별자이자 Tier1 RBAC 매트릭스 키다 — 어떤 resourceType에 어떤 액션이
 * 가능한지를 결정한다. 소속팀(Team)은 이 아래에 생긴다.
 */
@Entity()
export class Role extends BaseEntity {
  // 식별자 겸 Tier1 매트릭스 키. unique는 partial index(WHERE deleted_at IS NULL)로 가는 게 정석 —
  // soft-delete 후 동명 재생성 충돌 회피. Phase E 마이그레이션에서 partial unique로 전환.
  @Property({ type: 'varchar', length: 50, unique: true })
  name!: string; // 예: "BLUE"

  static create(name: string): Role {
    const role = new Role();
    role.name = name;
    return role;
  }

  rename(name: string): void {
    this.name = name;
  }
}
