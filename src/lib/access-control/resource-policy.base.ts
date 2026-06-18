import { ForbiddenException } from '@/common/exceptions';

import { Action } from './action.enum';
import { AuthSubject } from './auth-subject.type';
import { GlobalRole } from './global-role.enum';

/** 팀 소유 리소스가 만족해야 하는 최소 형태. 도메인 엔티티가 `team` 관계를 가진다. */
export interface TeamScoped {
  team: { id: number };
}

/**
 * ResourcePolicy (Tier2 ABAC) — 엔티티를 로드한 뒤 service에서 호출한다.
 *
 * Tier1(PolicyGuard)이 "역할이 액션을 할 수 있나"를 봤다면, 여기서는 "이 **특정 리소스**가
 * actor의 팀 소유인가, actor가 그 리소스에 권한이 있나"를 본다(엔티티가 필요하므로 가드가 아님).
 *
 * 도메인은 리소스별로 이 클래스를 상속해 can* 규칙을 구현한다.
 */
export abstract class ResourcePolicy<TEntity extends TeamScoped> {
  /** OWNER로 취급할 팀 역할명. 도메인 역할 enum이 다르면 오버라이드한다. */
  protected readonly ownerRole: string = 'OWNER';

  abstract canCreate(actor: AuthSubject, ctx: { teamId: number }): boolean;
  abstract canRead(actor: AuthSubject, resource: TEntity): boolean;
  abstract canUpdate(actor: AuthSubject, resource: TEntity): boolean;
  abstract canDelete(actor: AuthSubject, resource: TEntity): boolean;

  /** 인스턴스 액션(READ/UPDATE/DELETE) 인가. 거부 시 ForbiddenException. SUPER는 bypass. */
  authorize(actor: AuthSubject, action: Action.READ | Action.UPDATE | Action.DELETE, resource: TEntity): void {
    if (this.isSuper(actor)) return;

    const allowed =
      action === Action.READ
        ? this.canRead(actor, resource)
        : action === Action.UPDATE
          ? this.canUpdate(actor, resource)
          : this.canDelete(actor, resource);

    if (!allowed) {
      throw new ForbiddenException('해당 리소스에 대한 권한이 없습니다.');
    }
  }

  /** 생성 인가(엔티티가 아직 없으므로 teamId 컨텍스트로 판정). 거부 시 ForbiddenException. */
  authorizeCreate(actor: AuthSubject, ctx: { teamId: number }): void {
    if (this.isSuper(actor)) return;
    if (!this.canCreate(actor, ctx)) {
      throw new ForbiddenException('해당 리소스를 생성할 권한이 없습니다.');
    }
  }

  protected isSuper(actor: AuthSubject): boolean {
    return actor.globalRoles?.includes(GlobalRole.SUPER) ?? false;
  }

  protected membership(actor: AuthSubject, teamId: number) {
    return actor.teams?.find((t) => t.teamId === teamId);
  }

  protected isTeamMember(actor: AuthSubject, resource: TEntity): boolean {
    return !!this.membership(actor, resource.team.id);
  }

  protected isTeamOwner(actor: AuthSubject, resource: TEntity): boolean {
    return this.membership(actor, resource.team.id)?.role === this.ownerRole;
  }
}

/**
 * 로드 + Tier2 인가를 한 번에 묶는다. 인스턴스 라우트(`:id`)에서 "엔티티만 로드하고 authorize를
 * 빠뜨리는" 실수(= cross-team IDOR)를 막기 위한 안전 경로다. authorize 실패 시 ForbiddenException.
 *
 * @example
 *   const scenario = await loadAndAuthorize(
 *     (id) => this.repo.getById(id), this.policy, actor, Action.UPDATE, id,
 *   );
 */
export async function loadAndAuthorize<TEntity extends TeamScoped>(
  loader: (id: number) => Promise<TEntity>,
  policy: ResourcePolicy<TEntity>,
  actor: AuthSubject,
  action: Action.READ | Action.UPDATE | Action.DELETE,
  id: number,
): Promise<TEntity> {
  const entity = await loader(id);
  policy.authorize(actor, action, entity);
  return entity;
}
