import { Ref, ref } from '@mikro-orm/core';
import { Entity, Enum, Index, ManyToOne, Property } from '@mikro-orm/decorators/legacy';

import { BaseEntity } from '@/common/base/base.entity';
import { GlobalRole } from '@/lib/access-control';

import { TeamPosition } from '../enum/team-position.enum';

import { Team } from './team.entity';

/**
 * 사용자. 소속팀(Team)에 1개 속하며 팀 내 직위(LEADER/MEMBER)를 가진다.
 * 역할(capability)은 team.role을 통해 전이된다. `globalRoles`는 플랫폼 전역 권한(SUPER 등).
 */
@Entity()
// email unique는 partial index(soft-delete 후 동일 이메일 재가입 허용).
@Index({
  name: 'users_email_active_uq',
  expression:
    'create unique index if not exists "users_email_active_uq" on "users" ("email") where "deleted_at" is null',
})
export class User extends BaseEntity {
  @Property({ type: 'varchar', length: 255 })
  email!: string;

  /** argon2 해시. 직렬화에서 제외(hidden). */
  @Property({ type: 'varchar', length: 255, hidden: true, lazy: true })
  password!: string;

  @Property({ type: 'varchar', length: 100 })
  name!: string;

  // FK 컬럼은 인덱스 필수(11-query-strategy): JOIN seq scan + 부모 삭제 시 자식 풀스캔/락 방지.
  @ManyToOne(() => Team, { ref: true, index: true })
  team!: Ref<Team>;

  @Enum(() => TeamPosition)
  position!: TeamPosition;

  @Enum({ items: () => GlobalRole, array: true })
  globalRoles: GlobalRole[] = [];

  static create(params: {
    email: string;
    passwordHash: string;
    name: string;
    team: Team;
    position: TeamPosition;
    globalRoles?: GlobalRole[];
  }): User {
    const user = new User();
    user.email = params.email;
    user.password = params.passwordHash;
    user.name = params.name;
    user.team = ref(params.team);
    user.position = params.position;
    user.globalRoles = params.globalRoles ?? [];
    return user;
  }

  updateProfile(name: string): void {
    this.name = name;
  }

  changePosition(position: TeamPosition): void {
    this.position = position;
  }

  changePassword(passwordHash: string): void {
    this.password = passwordHash;
  }
}
