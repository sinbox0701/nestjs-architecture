import { Ref, ref } from '@mikro-orm/core';
import { Entity, Enum, ManyToOne, Property } from '@mikro-orm/decorators/legacy';

import { BaseEntity } from '@/common/base/base.entity';
import { GlobalRole } from '@/lib/access-control';

import { TeamPosition } from '../enum/team-position.enum';

import { Team } from './team.entity';

/**
 * 사용자. 소속팀(Team)에 1개 속하며 팀 내 직위(LEADER/MEMBER)를 가진다.
 * 역할(capability)은 team.role을 통해 전이된다. `globalRoles`는 플랫폼 전역 권한(SUPER 등).
 */
@Entity()
export class User extends BaseEntity {
  @Property({ type: 'varchar', length: 255, unique: true })
  email!: string;

  /** argon2 해시. 직렬화에서 제외(hidden). */
  @Property({ type: 'varchar', length: 255, hidden: true, lazy: true })
  password!: string;

  @Property({ type: 'varchar', length: 100 })
  name!: string;

  @ManyToOne(() => Team, { ref: true })
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
