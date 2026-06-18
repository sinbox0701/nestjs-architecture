import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Request } from 'express';

import { IS_PUBLIC_KEY } from '@/common/decorators/auth-public.decorator';
import { ForbiddenException } from '@/common/exceptions';

import { ACCESS_POLICY_PROVIDER, AccessPolicyProvider } from './access-policy.provider';
import { AuthSubject } from './auth-subject.type';
import { GlobalRole } from './global-role.enum';
import { REQUIRES_KEY, RequiresMetadata } from './requires.decorator';

/**
 * PolicyGuard (Tier1 RBAC) — JWT claim만으로 판정, DB 호출 없음.
 *
 * AuthGuard(인증) 다음 순서로 APP_GUARD에 등록한다. 판정 순서:
 *  1. `@Public()`이면 통과.
 *  2. `@Requires`가 없으면 거부(default-deny).
 *  3. `globalRoles`에 SUPER가 있으면 통과(IAM root bypass).
 *  4. 요청에서 teamId 추출 → `teams`에서 역할 찾기(없으면 거부).
 *  5. `AccessPolicyProvider`로 역할 × 액션 × 리소스 판정.
 *
 * 리소스 소유권 같은 인스턴스 단위 규칙은 가드가 아니라 service의 `ResourcePolicy`(Tier2)에서 본다.
 */
@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ACCESS_POLICY_PROVIDER) private readonly policy: AccessPolicyProvider,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const meta = this.reflector.getAllAndOverride<RequiresMetadata | undefined>(REQUIRES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // default-deny: 보호 라우트는 @Requires(또는 @Public)가 반드시 있어야 한다.
    if (!meta) {
      throw new ForbiddenException('이 라우트는 접근 권한 선언(@Requires)이 없어 거부되었습니다.');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthSubject | undefined;
    if (!user) {
      throw new ForbiddenException('인증 주체를 확인할 수 없습니다.');
    }

    // SUPER 전체 bypass.
    if (user.globalRoles?.includes(GlobalRole.SUPER)) return true;

    const extractTeamId = meta.options?.teamId ?? ((req: Request) => (req.params as Record<string, string>)?.teamId);
    // 엄격 파싱: Number()의 느슨한 coercion(' 7 ', '7.0', '0x7', '', true 등) 차단.
    // 정수 문자열 또는 정수 number만 허용해 라우트 teamId와 인가 판정값을 정규화한다.
    const rawTeamId = extractTeamId(request);
    const teamId =
      typeof rawTeamId === 'number' && Number.isInteger(rawTeamId)
        ? rawTeamId
        : /^\d+$/.test(String(rawTeamId ?? ''))
          ? Number(rawTeamId)
          : NaN;
    if (!Number.isInteger(teamId)) {
      throw new ForbiddenException('팀 컨텍스트(teamId)를 확인할 수 없습니다.');
    }

    const membership = user.teams?.find((t) => t.teamId === teamId);
    if (!membership) {
      throw new ForbiddenException('해당 팀에 대한 접근 권한이 없습니다.');
    }

    if (!this.policy.can(membership.role, meta.action, meta.resourceType)) {
      throw new ForbiddenException('해당 작업을 수행할 권한이 없습니다.');
    }

    return true;
  }
}
