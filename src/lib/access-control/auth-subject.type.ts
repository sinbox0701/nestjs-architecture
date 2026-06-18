import { GlobalRole } from './global-role.enum';

/** 팀 단위 멤버십. `role`의 구체 enum(OWNER/MANAGER/MEMBER 등)은 도메인에서 정의하므로 `string`. */
export interface TeamMembership {
  teamId: number;
  role: string;
}

/**
 * 인증된 주체(principal). AuthGuard가 검증 후 `request.user`에 주입한다.
 *
 * - `globalRoles`: 플랫폼 전역 역할(예: SUPER). 팀 소속과 무관하게 작동.
 * - `teams`: 팀별 역할. Tier1 RBAC가 요청의 teamId로 해당 역할을 찾는다.
 * 도메인 단계에서 필드를 확장한다(예: tenantId, profileId 등).
 */
export interface AuthSubject {
  id: string | number;
  jti: string;
  globalRoles: GlobalRole[];
  teams: TeamMembership[];
  [key: string]: unknown;
}
