import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Request } from 'express';

import { ForbiddenException } from '@/common/exceptions';

import { AuthSubject } from './auth-subject.type';
import { RoleCode } from './role-code.enum';
import { ROLES_KEY } from './roles.decorator';

/**
 * RolesGuard
 *
 * `@Roles(...)` 메타데이터가 없으면 통과(인증은 AuthGuard가 담당).
 * 메타데이터가 있으면 `request.user.roles`에 허용 역할이 하나라도 있는지 검사한다.
 *
 * AuthGuard 다음 순서로 APP_GUARD에 등록되어야 한다(인증 → 인가).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const required = this.reflector.getAllAndOverride<RoleCode[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthSubject | undefined;
    const userRoles = user?.roles ?? [];

    const allowed = required.some((role) => userRoles.includes(role));
    if (!allowed) {
      throw new ForbiddenException('해당 작업을 수행할 권한이 없습니다.');
    }

    return true;
  }
}
