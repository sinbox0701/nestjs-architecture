import { AbstractSqlConnection, EntityManager, MikroORM } from '@mikro-orm/postgresql';

import ormConfig from '@/lib/database/mikro-orm.config';
import { Role } from '@/modules/identity/entity/role.entity';
import { Team } from '@/modules/identity/entity/team.entity';
import { User } from '@/modules/identity/entity/user.entity';
import { TeamPosition } from '@/modules/identity/enum/team-position.enum';
import { TeamRosterReadModel } from '@/modules/identity/read-model/team-roster.read-model';

/**
 * TeamRosterReadModel 통합 — Kysely 집계 쿼리가 실제 Postgres에서 올바른 SQL로 컴파일되고
 * (다중 JOIN + GROUP BY + 조건부 카운트 + soft-delete 수동 필터) 정확한 집계를 반환하는지 검증한다.
 * "복잡 조회는 Kysely ReadModel" 경로의 동작 보증.
 */
describe('TeamRosterReadModel (Integration)', () => {
  let orm: MikroORM;
  let em: EntityManager;
  let readModel: TeamRosterReadModel;

  let teamA: Team;
  let teamB: Team;

  beforeAll(async () => {
    orm = await MikroORM.init({ ...ormConfig, entities: [Role, Team, User], entitiesTs: [Role, Team, User] });
    await orm.schema.ensureDatabase();
    await orm.schema.update();

    // 운영과 동일하게 MikroORM이 쓰는 Kysely 클라이언트(=커넥션 풀)를 그대로 재사용한다(v7).
    const client = (orm.em.getConnection() as AbstractSqlConnection).getClient();
    readModel = new TeamRosterReadModel(client);
  });

  afterAll(async () => {
    await orm.close(true);
  });

  beforeEach(async () => {
    em = orm.em.fork();
    await em.getConnection().execute('TRUNCATE TABLE "users", "teams", "roles" RESTART IDENTITY CASCADE');

    const role = Role.create('BLUE');
    teamA = Team.create('Team A', role);
    teamB = Team.create('Team B', role); // 멤버 0명 팀
    em.persist([role, teamA, teamB]);

    const mk = (email: string, team: Team, position: TeamPosition): User =>
      User.create({ email, passwordHash: 'x', name: email, team, position });
    // teamA: 팀장 1 + 팀원 2
    em.persist([
      mk('lead@a.com', teamA, TeamPosition.LEADER),
      mk('m1@a.com', teamA, TeamPosition.MEMBER),
      mk('m2@a.com', teamA, TeamPosition.MEMBER),
    ]);
    await em.flush();
  });

  it('팀별 멤버 수와 팀장 수를 집계한다 (멤버 0명 팀도 LEFT JOIN으로 포함)', async () => {
    const roster = await readModel.getTeamRoster();

    expect(roster).toHaveLength(2);
    const a = roster.find((r) => r.teamId === teamA.id);
    const b = roster.find((r) => r.teamId === teamB.id);
    expect(a).toMatchObject({ teamName: 'Team A', roleName: 'BLUE', memberCount: 3, leaderCount: 1 });
    expect(b).toMatchObject({ teamName: 'Team B', roleName: 'BLUE', memberCount: 0, leaderCount: 0 });
    // pg count는 문자열로 오므로 Number로 좁혀졌는지 확인.
    expect(typeof a!.memberCount).toBe('number');
  });

  it('soft-delete된 멤버는 집계에서 제외된다 (전역 필터가 아닌 수동 deleted_at 필터)', async () => {
    const member = await em.findOneOrFail(User, { email: 'm1@a.com' });
    member.deletedAt = new Date();
    await em.flush();

    const roster = await readModel.getTeamRoster();
    const a = roster.find((r) => r.teamId === teamA.id);
    expect(a).toMatchObject({ memberCount: 2, leaderCount: 1 });
  });

  it('teamIds로 특정 팀만 필터링한다', async () => {
    const roster = await readModel.getTeamRoster([teamA.id]);
    expect(roster).toHaveLength(1);
    expect(roster[0]!.teamId).toBe(teamA.id);
  });
});
