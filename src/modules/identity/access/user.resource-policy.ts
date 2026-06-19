import { Injectable } from '@nestjs/common';

import { ForbiddenException } from '@/common/exceptions';
import { AuthSubject, ResourcePolicy } from '@/lib/access-control';

import { User } from '../entity/user.entity';
import { TeamPosition } from '../enum/team-position.enum';

/**
 * UserResourcePolicy (Tier2 ABAC) — 로드된 User 인스턴스에 대한 소유권/역할 판정.
 *
 * Tier1(PolicyGuard)이 "권한팀 등급이 user 리소스를 다룰 수 있나"를 봤다면, 여기서는
 * "이 **특정 사용자**가 actor의 소속팀 소속인가, actor가 팀장인가, 자기 자신인가"를 본다.
 *
 * 규칙(SUPER는 전부 bypass):
 *  - READ   : 같은 소속팀 구성원이면 가능.
 *  - CREATE : 대상 팀의 팀장(LEADER)만 — 자기 팀에 멤버 추가.
 *  - UPDATE : 팀장은 같은 팀원 수정 가능 / 본인은 자기 프로필 수정 가능.
 *  - DELETE : 팀장만, 단 자기 자신은 삭제 불가.
 *  - 역할 변경: 팀장만, 자기 자신 제외(자기 권한 상승/강등 잠금 방지).
 */
@Injectable()
export class UserResourcePolicy extends ResourcePolicy<User> {
  protected override readonly ownerRole = TeamPosition.LEADER;

  canCreate(actor: AuthSubject, ctx: { teamId: number }): boolean {
    return this.membership(actor, ctx.teamId)?.role === this.ownerRole;
  }

  canRead(actor: AuthSubject, resource: User): boolean {
    return this.isTeamMember(actor, resource);
  }

  canUpdate(actor: AuthSubject, resource: User): boolean {
    return this.isTeamOwner(actor, resource) || this.isSelf(actor, resource);
  }

  canDelete(actor: AuthSubject, resource: User): boolean {
    return this.isTeamOwner(actor, resource) && !this.isSelf(actor, resource);
  }

  /** 역할 변경 인가. 거부 시 ForbiddenException. SUPER는 bypass. */
  authorizeChangeRole(actor: AuthSubject, resource: User): void {
    if (this.isSuper(actor)) return;
    if (!(this.isTeamOwner(actor, resource) && !this.isSelf(actor, resource))) {
      throw new ForbiddenException('역할을 변경할 권한이 없습니다.');
    }
  }

  private isSelf(actor: AuthSubject, resource: User): boolean {
    // AuthSubject.id는 string|number(JWT sub) — Number() 변환 시 NaN 리스크가 있어 문자열로 비교.
    return String(actor.id) === String(resource.id);
  }
}
