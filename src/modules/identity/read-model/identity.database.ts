/**
 * identity 도메인 테이블의 Kysely 스키마 타입.
 *
 * ⚠️ 트레이드오프: 이 인터페이스는 MikroORM 엔티티와 **별도의 진실원천**이다(Kysely는 자체 타입을
 * 요구). 컬럼명은 DB 실제 이름(snake_case, CustomNamingStrategy 결과)이며, 엔티티를 바꾸면 여기도
 * 함께 갱신해야 한다. 테이블이 많아지면 `kysely-codegen`으로 자동 생성을 검토한다.
 * 참조: docs/convention/10-query-strategy.md
 *
 * 집계 ReadModel에 필요한 컬럼만 선언한다(전체 미러링 불필요).
 */
export interface UsersTable {
  id: number;
  team_id: number;
  position: string;
  deleted_at: Date | null;
}

export interface TeamsTable {
  id: number;
  name: string;
  role_id: number;
  deleted_at: Date | null;
}

export interface RolesTable {
  id: number;
  name: string;
  deleted_at: Date | null;
}

export interface IdentityDatabase {
  users: UsersTable;
  teams: TeamsTable;
  roles: RolesTable;
}
