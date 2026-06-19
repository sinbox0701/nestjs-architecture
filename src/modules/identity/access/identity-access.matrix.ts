import { Action, AuthSubject, RoleActionMatrix, RoleResolver } from '@/lib/access-control';

/**
 * identity 도메인의 Tier1 capability 매트릭스.
 *
 * 매트릭스 **키 = 역할(Role) 이름**. 역할은 "무엇을 할 수 있는가"(capability class)를 나타낸다.
 * 사용자는 소속팀(Team) 1개에 속하고, 그 소속팀은 역할 1개에 속하므로 → 사용자의 capability는
 * `team.role.name`으로 전이된다. 이 이름이 매트릭스 키가 된다.
 *
 * - `Red`  : 운영 역할 — 사용자 리소스를 전부 관리(CRUD).
 * - `Blue` : 읽기 역할 — 사용자 리소스 읽기만.
 * - `team` / `role`(플랫폼 구조)은 어떤 역할에도 부여하지 않는다 → SUPER만 PolicyGuard를 통과.
 *
 * "이 인스턴스가 내 소속팀 것인가 / 내가 팀장인가" 같은 인스턴스 단위 판정은 여기(Tier1)가 아니라
 * `UserResourcePolicy`(Tier2)에서 한다. 여기서는 capability 등급만 본다.
 *
 * 역할은 런타임 CRUD 대상이라 새 역할은 이 코드 매트릭스에 항목이 없어 default-deny된다.
 * 런타임 편집이 필요하면 DB 오버레이 구현으로 `ACCESS_POLICY_PROVIDER`를 교체한다(스타터 범위 밖).
 */
export const IDENTITY_ROLE_MATRIX: RoleActionMatrix = {
  Red: { user: [Action.MANAGE] },
  Blue: { user: [Action.READ] },
};

/** JWT에 실린 역할 정보(토큰 payload → AuthSubject로 spread됨). */
interface WithAccessRole {
  role?: { name?: string };
}

/** 주체의 역할 이름을 매트릭스 키로 추출한다. 없으면 빈 배열 → default-deny. */
export const resolveAccessRoles: RoleResolver = (subject: AuthSubject): string[] => {
  const name = (subject as WithAccessRole).role?.name;
  return name ? [name] : [];
};
