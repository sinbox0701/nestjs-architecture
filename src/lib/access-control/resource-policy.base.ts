import { ForbiddenException } from '@/common/exceptions';

import { Action, ActionLike } from './action.enum';
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

  /**
   * 인스턴스 액션 인가. 거부 시 ForbiddenException. SUPER는 bypass.
   * 기본은 CRUD(READ/UPDATE/DELETE)를 canRead/canUpdate/canDelete로 매핑한다.
   * 커스텀 액션(예: `'order:cancel'`)은 **default-deny**이며, 도메인이 이 메서드를 오버라이드해 처리한다.
   */
  authorize(actor: AuthSubject, action: ActionLike, resource: TEntity): void {
    if (this.isSuper(actor)) return;

    const allowed =
      action === Action.READ
        ? this.canRead(actor, resource)
        : action === Action.UPDATE
          ? this.canUpdate(actor, resource)
          : action === Action.DELETE
            ? this.canDelete(actor, resource)
            : false; // 커스텀 액션: 베이스는 모름 → 거부(도메인 오버라이드 필요)

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
 * `options.maskNotFound`를 주면 인가 실패(Forbidden)를 그 팩토리가 만든 예외로 바꿔 던진다.
 * 존재가 민감하고 ID가 추측 가능한 리소스에서 "존재하지만 권한 없음(403)"과 "미존재(404)"를 같은
 * 응답으로 만들어 enumeration 오라클을 없앤다. **리소스 미존재 시 loader가 던지는 예외와 동일한
 * 팩토리를 넘겨야** 두 경로가 구분 불가능해진다.
 *
 * @example
 *   const user = await loadAndAuthorize(
 *     (id) => this.getUserOrThrow(id), this.policy, actor, Action.READ, id,
 *     { maskNotFound: () => USER_EXCEPTIONS.NOT_FOUND() },
 *   );
 */
export async function loadAndAuthorize<TEntity extends TeamScoped>(
  loader: (id: number) => Promise<TEntity>,
  policy: ResourcePolicy<TEntity>,
  actor: AuthSubject,
  action: ActionLike,
  id: number,
  options?: { maskNotFound?: () => Error },
): Promise<TEntity> {
  const entity = await loader(id);
  try {
    policy.authorize(actor, action, entity);
  } catch (e) {
    if (options?.maskNotFound && e instanceof ForbiddenException) {
      throw options.maskNotFound();
    }
    throw e;
  }
  return entity;
}
