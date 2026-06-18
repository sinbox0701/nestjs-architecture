import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { Request } from 'express';

import { AuthSubject } from './auth-subject.type';

/**
 * 컨트롤러 핸들러에 인증 주체(AuthSubject)를 주입한다. AuthGuard가 `request.user`에 넣은 값을 꺼낸다.
 *
 * service로 actor를 넘길 때 사용한다(Tier2 ResourcePolicy 인가 등).
 * `@Public()` 라우트에서는 undefined일 수 있다.
 *
 * @example
 *   @Requires(Action.UPDATE, 'scenario')
 *   @Patch(':teamId/scenarios/:id')
 *   update(@CurrentUser() actor: AuthSubject, @Body() dto: UpdateScenarioRequest) {}
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthSubject | undefined => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return request.user as AuthSubject | undefined;
});
