import { Action, ActionLike } from './action.enum';

/**
 * 역할 × 액션 매트릭스 평가기. Tier1 PolicyGuard가 "이 팀 역할이 이 리소스에 이 액션을 할 수 있나"를
 * 묻는다. 스타터는 인터페이스 + 코드 기반 구현을 제공하고, 런타임 커스텀(관리자가 역할 편집)이
 * 필요하면 도메인이 DB 구현으로 `ACCESS_POLICY_PROVIDER` 토큰을 교체한다(코드 기본 + DB 오버레이).
 */
export interface AccessPolicyProvider {
  can(role: string, action: ActionLike, resourceType: string): boolean;
}

/** DI 토큰. 도메인은 이 토큰에 자신의 매트릭스 구현을 바인딩한다. */
export const ACCESS_POLICY_PROVIDER = Symbol('ACCESS_POLICY_PROVIDER');

/**
 * `role → resourceType → 허용 액션[]` 매트릭스.
 * - `resourceType` 키에 `'*'`를 쓰면 모든 리소스에 적용.
 * - 허용 액션에 `Action.MANAGE`(또는 `'*'`)가 있으면 모든 액션 허용.
 *
 * @example
 *   { OWNER: { '*': [Action.MANAGE] }, MEMBER: { scenario: [Action.READ] } }
 */
export type RoleActionMatrix = Record<string, Record<string, ActionLike[]>>;

/** 매트릭스 객체 기반 구현(코드 기본). 도메인이 매트릭스를 주입해 사용한다. */
export class StaticAccessPolicyProvider implements AccessPolicyProvider {
  constructor(private readonly matrix: RoleActionMatrix) {}

  can(role: string, action: ActionLike, resourceType: string): boolean {
    const byResource = this.matrix[role];
    if (!byResource) return false;
    const actions = byResource[resourceType] ?? byResource['*'];
    if (!actions) return false;
    return actions.includes(action) || actions.includes(Action.MANAGE) || actions.includes('*');
  }
}

/**
 * 기본 구현: 전부 거부. 스타터는 도메인 역할을 모르므로 default-deny를 유지한다.
 * 도메인이 `ACCESS_POLICY_PROVIDER`를 실제 매트릭스(`StaticAccessPolicyProvider` 등)로 교체해야
 * 보호 라우트가 통과한다.
 */
export class DenyAllAccessPolicyProvider implements AccessPolicyProvider {
  can(_role: string, _action: ActionLike, _resourceType: string): boolean {
    return false;
  }
}
