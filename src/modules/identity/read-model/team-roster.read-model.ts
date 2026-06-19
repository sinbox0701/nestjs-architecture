import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from '@mikro-orm/postgresql';

import { AppKysely, KYSELY_DB } from '@/lib/database/kysely/kysely.module';

import { TeamPosition } from '../enum/team-position.enum';

import { IdentityDatabase } from './identity.database';

/** 팀별 인원 집계 행. */
export interface TeamRosterRow {
  teamId: number;
  teamName: string;
  roleName: string;
  memberCount: number;
  leaderCount: number;
}

/**
 * 팀 로스터 ReadModel — "복잡 조회(다중 JOIN + GROUP BY + 집계)" 경로의 레퍼런스 구현.
 *
 * 같은 결과를 MikroORM QueryBuilder로 짜면 어색하고(집계+조건부 카운트), 엔티티 전체를
 * 하이드레이트할 필요도 없다 → Kysely로 필요한 컬럼만 투영해 한 방 쿼리로 집계한다.
 *
 * 규칙(참조: docs/convention/10-query-strategy.md):
 * - **읽기 전용**. 쓰기는 MikroORM Unit of Work로만 한다.
 * - 효율을 위해 도메인 경계를 가로지르는 JOIN을 허용한다(여기선 같은 도메인이지만 3 테이블 JOIN).
 * - **전역 softDelete 필터는 Kysely에 적용되지 않는다** → `deleted_at IS NULL`을 직접 명시한다.
 * - 결과 타입을 명시한다(`any` 금지). pg는 `count()`를 문자열로 반환하므로 `Number()`로 좁힌다.
 */
@Injectable()
export class TeamRosterReadModel {
  /** lib는 도메인을 모르므로 주입은 `AppKysely`, 사용처에서 도메인 스키마로 좁힌다. */
  private readonly db: Kysely<IdentityDatabase>;

  constructor(@Inject(KYSELY_DB) db: AppKysely) {
    this.db = db as Kysely<IdentityDatabase>;
  }

  async getTeamRoster(teamIds?: number[]): Promise<TeamRosterRow[]> {
    let query = this.db
      .selectFrom('teams')
      .innerJoin('roles', 'roles.id', 'teams.role_id')
      // 살아있는 멤버만 카운트 → JOIN 조건에 soft-delete 필터를 건다(LEFT JOIN: 멤버 0명 팀도 포함).
      .leftJoin('users', (join) => join.onRef('users.team_id', '=', 'teams.id').on('users.deleted_at', 'is', null))
      .where('teams.deleted_at', 'is', null)
      .where('roles.deleted_at', 'is', null)
      .groupBy(['teams.id', 'teams.name', 'roles.name'])
      .select((eb) => [
        'teams.id as teamId',
        'teams.name as teamName',
        'roles.name as roleName',
        eb.fn.count('users.id').as('memberCount'),
        // 조건부 카운트는 SQL 표준 `count(...) FILTER (WHERE ...)`로 — 팀장 수만 센다.
        eb.fn.count('users.id').filterWhere('users.position', '=', TeamPosition.LEADER).as('leaderCount'),
      ])
      .orderBy('teams.id');

    if (teamIds && teamIds.length > 0) {
      query = query.where('teams.id', 'in', teamIds);
    }

    const rows = await query.execute();
    return rows.map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      roleName: row.roleName,
      memberCount: Number(row.memberCount),
      leaderCount: Number(row.leaderCount),
    }));
  }
}
