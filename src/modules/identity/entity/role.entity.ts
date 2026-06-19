import { Entity, Index, Property } from '@mikro-orm/decorators/legacy';

import { BaseEntity } from '@/common/base/base.entity';

/**
 * 역할 (Red/Blue…). 색으로 구분되는 **플랫폼 capability 그룹**.
 * `name`(예: "BLUE")이 식별자이자 Tier1 RBAC 매트릭스 키다 — 어떤 resourceType에 어떤 액션이
 * 가능한지를 결정한다. 소속팀(Team)은 이 아래에 생긴다.
 */
@Entity()
// name unique는 partial index(WHERE deleted_at IS NULL)로 — soft-delete 후 동명 재생성 충돌 회피.
// expression으로 선언하면 schema-gen·migration 양쪽에 반영돼 fresh==migrated 정합성이 유지된다.
@Index({
  name: 'roles_name_active_uq',
  expression: 'create unique index if not exists "roles_name_active_uq" on "roles" ("name") where "deleted_at" is null',
})
export class Role extends BaseEntity {
  // 식별자 겸 Tier1 매트릭스 키.
  @Property({ type: 'varchar', length: 50 })
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
