/**
 * 제네릭 역할 코드(샘플).
 *
 * 프로젝트 도메인에 맞게 값을 교체/확장한다. RolesGuard와 @Roles()가 이 enum을 사용한다.
 * 팀/리소스 단위 ABAC가 필요하면 ResourcePolicy 추상(access-control/types)을 추가해 확장한다.
 */
export enum RoleCode {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER = 'SUPER',
}

/** 역할 위계(높을수록 강함). RolesGuard가 "이상" 비교에 사용할 수 있다. */
export const ROLE_RANK: Record<RoleCode, number> = {
  [RoleCode.USER]: 0,
  [RoleCode.ADMIN]: 10,
  [RoleCode.SUPER]: 20,
};
