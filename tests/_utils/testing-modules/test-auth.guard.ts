import { CanActivate, ExecutionContext } from '@nestjs/common';

import { AuthSubject, GlobalRole } from '@/lib/access-control';

/**
 * E2E/통합 테스트용 인증 가드.
 *
 * 실제 JWT 검증을 건너뛰고 가짜 AuthSubject 를 `request.user` 에 주입해 인증을 항상 통과시킨다.
 * `globalRoles: [SUPER]`라 Tier1 PolicyGuard도 bypass된다. AppModule 의 APP_GUARD(AuthGuard)를
 * override 하는 용도다. 특정 팀 역할을 검증하는 테스트는 이 가드 대신 직접 주체를 구성한다.
 */
export class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: AuthSubject }>();
    req.user = { id: 1, jti: 'test', globalRoles: [GlobalRole.SUPER], teams: [] };
    return true;
  }
}
