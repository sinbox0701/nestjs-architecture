import { RoleCode } from './role-code.enum';

/**
 * 인증된 주체(principal). AuthGuard가 검증 후 `request.user`에 주입한다.
 * 도메인 단계에서 필드를 확장한다(예: tenantId, profileId 등).
 */
export interface AuthSubject {
  id: string | number;
  roles: RoleCode[];
  [key: string]: unknown;
}
