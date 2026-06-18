import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { Request } from 'express';

import { IS_PUBLIC_KEY } from '@/common/decorators/auth-public.decorator';
import { UnauthorizedException } from '@/common/exceptions';
import { AuthSubject, RoleCode } from '@/lib/access-control';

interface JwtPayload {
  sub: string | number;
  roles?: RoleCode[];
  [key: string]: unknown;
}

/**
 * AuthGuard (제네릭 JWT)
 *
 * - `@Public()` 엔드포인트는 인증을 건너뛴다.
 * - `Authorization: Bearer <token>` 헤더의 JWT 서명을 검증하고
 *   페이로드를 `request.user`(AuthSubject)로 주입한다.
 *
 * 토큰 발급(로그인)·사용자 저장소는 도메인 단계에서 구현한다.
 * 이 가드는 서명 검증 + principal 주입만 담당하는 제네릭 골격이다.
 * APP_GUARD 순서: AuthGuard(인증) → RolesGuard(인가).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('인증이 필요합니다. 로그인 후 다시 시도해주세요.');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('유효하지 않거나 만료된 토큰입니다.');
    }

    const subject: AuthSubject = {
      ...payload,
      id: payload.sub,
      roles: payload.roles ?? [],
    };
    request.user = subject;

    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
    return value.trim();
  }
}
