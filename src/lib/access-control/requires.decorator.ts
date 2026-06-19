import { SetMetadata } from '@nestjs/common';

import { ActionLike } from './action.enum';

export const REQUIRES_KEY = 'access:requires';

export interface RequiresMetadata {
  action: ActionLike;
  resourceType: string;
}

/**
 * Tier1 RBAC 선언. 이 라우트에 필요한 (액션 × 리소스 타입)을 명시한다.
 * default-deny이므로 보호 라우트는 이 데코레이터(또는 `@Public()`)가 **반드시** 있어야 한다.
 *
 * 인스턴스 단위 소유권("내 팀의 리소스인가")은 여기서 보지 않는다 — service의 `ResourcePolicy`(Tier2)가 본다.
 *
 * @example
 *   @Requires(Action.UPDATE, 'user')
 *   @Patch(':id')
 *   update(@CurrentUser() actor: AuthSubject) {}
 */
export const Requires = (action: ActionLike, resourceType: string) =>
  SetMetadata<string, RequiresMetadata>(REQUIRES_KEY, { action, resourceType });
