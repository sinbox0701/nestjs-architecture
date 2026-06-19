import { EntityManager, MikroORM } from '@mikro-orm/postgresql';

import { AuthSubject, GlobalRole } from '@/lib/access-control';
import ormConfig from '@/lib/database/mikro-orm.config';
import { UserResourcePolicy } from '@/modules/identity/access/user.resource-policy';
import { GetUserListRequest } from '@/modules/identity/dto/get-user.dto';
import { Role } from '@/modules/identity/entity/role.entity';
import { Team } from '@/modules/identity/entity/team.entity';
import { User } from '@/modules/identity/entity/user.entity';
import { TeamPosition } from '@/modules/identity/enum/team-position.enum';
import { TeamRepository } from '@/modules/identity/repository/team.repository';
import { UserRepository } from '@/modules/identity/repository/user.repository';
import { UserService } from '@/modules/identity/service/user.service';

/**
 * UserService 통합 — 실제 DB에서 Tier2 인가 + 쿼리(soft-delete, partial unique, 팀 스코프)를 검증한다.
 * Tier1(capability)은 unit/e2e에서 다루고, 여기서는 서비스+레포+정책+DB 합주를 본다.
 */
describe('UserService (Integration)', () => {
  let orm: MikroORM;
  let em: EntityManager;
  let service: UserService;

  // 시드 식별자(테스트마다 재시드)
  let teamA: Team;
  let teamB: Team;

  // actor id는 DB serial user id(RESTART IDENTITY로 1부터)와 충돌하면 안 된다(isSelf 오판) → 1000+ 사용.
  const actor = (id: number, teamId: number, position: TeamPosition): AuthSubject => ({
    id,
    jti: 'j',
    globalRoles: [],
    teams: [{ teamId, role: position }],
  });
  const superActor: AuthSubject = { id: 999, jti: 'j', globalRoles: [GlobalRole.SUPER], teams: [] };

  beforeAll(async () => {
    // jest(@swc/jest) 환경에서는 glob 기반 엔티티 discovery가 동작하지 않아(메타데이터 0개) 클래스를
    // 명시적으로 주입한다. truncateAll/스키마 동기화가 메타데이터에 의존하므로 필수.
    orm = await MikroORM.init({ ...ormConfig, entities: [Role, Team, User], entitiesTs: [Role, Team, User] });
    await orm.schema.ensureDatabase();
    await orm.schema.update(); // 엔티티 기준 스키마 동기화 (v7: updateSchema→update)
  });

  afterAll(async () => {
    await orm.close(true);
  });

  beforeEach(async () => {
    // 테스트마다 fresh fork — 전역 EM 직접 사용 금지(allowGlobalContext off) + 테스트 간 격리.
    // 전역 EM 직접 사용 금지(allowGlobalContext off) → 테스트마다 fresh fork.
    em = orm.em.fork();
    // 격리: 같은 fork 커넥션에서 truncate 후 seed flush가 한 트랜잭션으로 커밋되게 한다.
    // (throwaway fork로 truncate하면 미flush로 롤백되어 안 지워짐 — truncateAll 헬퍼의 알려진 한계)
    await em.getConnection().execute('TRUNCATE TABLE "users", "teams", "roles" RESTART IDENTITY CASCADE');
    service = new UserService(new UserRepository(em), new TeamRepository(em), new UserResourcePolicy());

    const role = Role.create('Red');
    teamA = Team.create('Team A', role);
    teamB = Team.create('Team B', role);
    em.persist([role, teamA, teamB]);
    await em.flush();
  });

  /** teamA의 LEADER로 행동하는 actor (생성/관리 권한). */
  const leaderOfA = () => actor(1001, teamA.id, TeamPosition.LEADER);

  it('팀장은 자기 팀에 사용자를 생성한다', async () => {
    const created = await service.createUser(leaderOfA(), {
      email: 'a@x.com',
      password: 'password123',
      name: '에이',
      teamId: teamA.id,
      position: TeamPosition.MEMBER,
    });
    expect(created).toMatchObject({ email: 'a@x.com', teamId: teamA.id, position: TeamPosition.MEMBER });
  });

  it('팀원(비팀장)은 사용자 생성이 거부된다(Tier2 canCreate)', async () => {
    const member = actor(1002, teamA.id, TeamPosition.MEMBER);
    await expect(
      service.createUser(member, {
        email: 'b@x.com',
        password: 'password123',
        name: '비',
        teamId: teamA.id,
        position: TeamPosition.MEMBER,
      }),
    ).rejects.toThrow('생성할 권한이 없습니다'); // Tier2 authorizeCreate 거부(다른 예외와 구분)
  });

  it('중복 이메일은 거부된다', async () => {
    const dto = {
      email: 'dup@x.com',
      password: 'password123',
      name: '중복',
      teamId: teamA.id,
      position: TeamPosition.MEMBER,
    };
    await service.createUser(leaderOfA(), dto);
    await expect(service.createUser(leaderOfA(), { ...dto })).rejects.toMatchObject({
      response: { error: { code: 'USER_EMAIL_DUPLICATED' } },
    });
  });

  it('cross-team 단건 조회는 거부된다(IDOR 차단)', async () => {
    const target = await service.createUser(leaderOfA(), {
      email: 'a@x.com',
      password: 'password123',
      name: '에이',
      teamId: teamA.id,
      position: TeamPosition.MEMBER,
    });
    const outsider = actor(1003, teamB.id, TeamPosition.LEADER);
    // cross-team read는 Tier2 authorize에서 거부(403).
    await expect(service.getUser(outsider, target.id)).rejects.toThrow('해당 리소스에 대한 권한이 없습니다');
  });

  it('목록은 actor의 소속팀으로 스코프되고, SUPER는 전체를 본다', async () => {
    await service.createUser(leaderOfA(), {
      email: 'a1@x.com',
      password: 'password123',
      name: 'a1',
      teamId: teamA.id,
      position: TeamPosition.MEMBER,
    });
    await service.createUser(superActor, {
      email: 'b1@x.com',
      password: 'password123',
      name: 'b1',
      teamId: teamB.id,
      position: TeamPosition.MEMBER,
    });

    const scopedToA = await service.getUserList(leaderOfA(), { offset: 0, limit: 20 } as GetUserListRequest);
    expect(scopedToA.list.every((u) => u.teamId === teamA.id)).toBe(true);
    expect(scopedToA.count).toBe(1);

    const all = await service.getUserList(superActor, { offset: 0, limit: 20 } as GetUserListRequest);
    expect(all.count).toBe(2);
  });

  it('soft-delete된 사용자는 이후 조회에서 제외되고, 같은 이메일 재생성이 허용된다(partial unique)', async () => {
    const u = await service.createUser(leaderOfA(), {
      email: 'reuse@x.com',
      password: 'password123',
      name: '재사용',
      teamId: teamA.id,
      position: TeamPosition.MEMBER,
    });
    await service.deleteUser(leaderOfA(), u.id);
    em.clear();

    // 조회 제외(soft-delete 필터 → NOT_FOUND). SUPER라 인가는 통과하지만 행이 없어 NOT_FOUND.
    await expect(service.getUser(superActor, u.id)).rejects.toMatchObject({
      response: { error: { code: 'USER_NOT_FOUND' } },
    });
    // 동일 이메일 재생성 OK (partial unique: 죽은 행은 제약에서 제외)
    const again = await service.createUser(leaderOfA(), {
      email: 'reuse@x.com',
      password: 'password123',
      name: '재사용2',
      teamId: teamA.id,
      position: TeamPosition.MEMBER,
    });
    expect(again.email).toBe('reuse@x.com');
    expect(again.id).not.toBe(u.id);
  });
});
