import { SetMetadata } from '@nestjs/common';

import { Request } from 'express';

import { ActionLike } from './action.enum';

export const REQUIRES_KEY = 'access:requires';

export interface RequiresOptions {
  /**
   * 요청에서 teamId를 추출하는 함수. 기본값은 `request.params.teamId`.
   * teamId가 다른 위치(body, query, header)에 있으면 지정한다.
   */
  teamId?: (req: Request) => number | string | undefined;
}

export interface RequiresMetadata {
  action: ActionLike;
  resourceType: string;
  options?: RequiresOptions;
}

/**
 * Tier1 RBAC 선언. 이 라우트에 필요한 (액션 × 리소스 타입)을 명시한다.
 * default-deny이므로 보호 라우트는 이 데코레이터(또는 `@Public()`)가 **반드시** 있어야 한다.
 *
 * @example
 *   @Requires(Action.UPDATE, 'scenario')
 *   @Patch(':teamId/scenarios/:id')
 *   update() {}
 */
export const Requires = (action: ActionLike, resourceType: string, options?: RequiresOptions) =>
  SetMetadata<string, RequiresMetadata>(REQUIRES_KEY, { action, resourceType, options });
