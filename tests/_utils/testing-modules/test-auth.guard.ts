import { CanActivate, ExecutionContext } from '@nestjs/common';

import { AuthSubject, RoleCode } from '@/lib/access-control';

/**
 * E2E/통합 테스트용 인증 가드.
 *
 * 실제 JWT 검증을 건너뛰고 가짜 AuthSubject 를 `request.user` 에 주입해
 * 인증을 항상 통과시킨다. AppModule 의 APP_GUARD(AuthGuard)를 override 하는 용도다.
 */
export class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: AuthSubject }>();
    req.user = { id: 1, roles: [RoleCode.ADMIN] };
    return true;
  }
}
