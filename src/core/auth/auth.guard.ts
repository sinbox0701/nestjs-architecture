import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { Request } from 'express';

import { IS_PUBLIC_KEY } from '@/common/decorators/auth-public.decorator';
import { UnauthorizedException } from '@/common/exceptions';
import { AuthSubject, GlobalRole, TeamMembership } from '@/lib/access-control';
import { RedisClient } from '@/lib/redis/redis.client';

import { BLOCKLIST_PREFIX } from './auth.constants';

interface JwtPayload {
  sub: string | number;
  jti?: string;
  globalRoles?: GlobalRole[];
  teams?: TeamMembership[];
  [key: string]: unknown;
}

/**
 * AuthGuard (Tier0 인증, 제네릭 JWT)
 *
 * - `@Public()` 엔드포인트는 인증을 건너뛴다.
 * - `Authorization: Bearer <token>` JWT 서명을 검증한다.
 * - `blocked:{jti}` Redis blocklist를 확인한다(강제 로그아웃된 세션이면 401).
 * - 페이로드를 `request.user`(AuthSubject)로 주입한다.
 *
 * 토큰 발급/리프레시·blocklist 등록(로그인/로그아웃)·사용자 저장소는 도메인 단계에서 구현한다.
 * APP_GUARD 순서: AuthGuard(인증) → PolicyGuard(인가).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly redis: RedisClient,
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

    // jti 없는 토큰은 거부한다. 발급자(TokenService)는 항상 jti를 넣으므로 jti 부재는 위조/구버전
    // 신호이며, blocklist로 무효화할 수 없는 토큰(강제 로그아웃 불가)을 수락하면 안 된다.
    if (!payload.jti) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }
    // 강제 로그아웃 체크. Redis 장애 시 safeGet은 null을 반환하므로 토큰은 유효한 것으로 본다
    // (access token이 단기라 fail-open 허용; 더 강한 보안이 필요하면 fail-closed로 전환).
    const blocked = await this.redis.safeGet(`${BLOCKLIST_PREFIX}${payload.jti}`);
    if (blocked) {
      throw new UnauthorizedException('로그아웃된 세션입니다. 다시 로그인해주세요.');
    }

    const subject: AuthSubject = {
      ...payload,
      id: payload.sub,
      jti: payload.jti, // 위에서 부재를 거부했으므로 항상 존재
      globalRoles: payload.globalRoles ?? [],
      teams: payload.teams ?? [],
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
