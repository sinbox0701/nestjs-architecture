import { Action, AuthSubject, GlobalRole } from '@/lib/access-control';
import { UserResourcePolicy } from '@/modules/identity/access/user.resource-policy';
import { User } from '@/modules/identity/entity/user.entity';
import { TeamPosition } from '@/modules/identity/enum/team-position.enum';

/** team.id / id만 보는 정책이므로 최소 형태의 User로 충분(populate 불필요). */
function makeUser(id: number, teamId: number): User {
  return { id, team: { id: teamId } } as unknown as User;
}

function makeActor(params: {
  id: number;
  teamId?: number;
  position?: TeamPosition;
  globalRoles?: AuthSubject['globalRoles'];
}): AuthSubject {
  return {
    id: params.id,
    jti: 'j',
    globalRoles: params.globalRoles ?? [],
    teams: params.teamId ? [{ teamId: params.teamId, role: params.position ?? TeamPosition.MEMBER }] : [],
  };
}

describe('UserResourcePolicy (Tier2)', () => {
  const policy = new UserResourcePolicy();
  const resource = makeUser(10, 7); // user#10, team#7

  const leader = makeActor({ id: 1, teamId: 7, position: TeamPosition.LEADER });
  const member = makeActor({ id: 2, teamId: 7, position: TeamPosition.MEMBER });
  const self = makeActor({ id: 10, teamId: 7, position: TeamPosition.MEMBER }); // 본인(=resource)
  const outsider = makeActor({ id: 3, teamId: 9, position: TeamPosition.LEADER }); // 타 팀
  // SUPER: 팀 멤버십과 무관하게 전부 bypass.
  const superUser = makeActor({ id: 99, globalRoles: [GlobalRole.SUPER] });

  describe('canRead — 같은 소속팀 구성원만', () => {
    it('같은 팀이면 true', () => expect(policy.canRead(leader, resource)).toBe(true));
    it('같은 팀 팀원도 true', () => expect(policy.canRead(member, resource)).toBe(true));
    it('다른 팀은 false', () => expect(policy.canRead(outsider, resource)).toBe(false));
  });

  describe('canCreate — 대상 팀의 팀장만', () => {
    it('대상 팀 팀장이면 true', () => expect(policy.canCreate(leader, { teamId: 7 })).toBe(true));
    it('대상 팀 팀원이면 false', () => expect(policy.canCreate(member, { teamId: 7 })).toBe(false));
    it('소속하지 않은 팀이면 false', () => expect(policy.canCreate(leader, { teamId: 999 })).toBe(false));
  });

  describe('canUpdate — 팀장(타팀원) 또는 본인(프로필)', () => {
    it('팀장은 같은 팀원 수정 가능', () => expect(policy.canUpdate(leader, resource)).toBe(true));
    it('본인은 본인 수정 가능', () => expect(policy.canUpdate(self, resource)).toBe(true));
    it('일반 팀원이 남을 수정하면 false', () => expect(policy.canUpdate(member, resource)).toBe(false));
    it('타 팀 팀장도 false', () => expect(policy.canUpdate(outsider, resource)).toBe(false));
  });

  describe('canDelete — 팀장만, 본인 제외', () => {
    it('팀장이 팀원 삭제 가능', () => expect(policy.canDelete(leader, resource)).toBe(true));
    it('팀장이 자기 자신 삭제 불가', () => {
      const leaderSelf = makeUser(1, 7); // resource.id === leader.id
      expect(policy.canDelete(leader, leaderSelf)).toBe(false);
    });
    it('팀원은 삭제 불가', () => expect(policy.canDelete(member, resource)).toBe(false));
  });

  describe('authorize — 거부 시 ForbiddenException', () => {
    it('READ 거부(타팀)는 권한 없음 메시지로 throw', () =>
      expect(() => policy.authorize(outsider, Action.READ, resource)).toThrow('해당 리소스에 대한 권한이 없습니다'));
    it('SUPER는 전부 bypass', () => {
      expect(() => policy.authorize(superUser, Action.DELETE, resource)).not.toThrow();
    });
  });

  describe('authorizeChangeRole — 직위 변경은 팀장만, 본인 제외(권한상승 차단)', () => {
    it('팀장이 팀원 직위 변경 가능', () => expect(() => policy.authorizeChangeRole(leader, resource)).not.toThrow());
    it('팀장이 본인 직위 변경 불가(self-escalation 차단)', () => {
      const leaderSelf = makeUser(1, 7);
      expect(() => policy.authorizeChangeRole(leader, leaderSelf)).toThrow('역할을 변경할 권한이 없습니다');
    });
    it('팀원은 직위 변경 불가', () =>
      expect(() => policy.authorizeChangeRole(member, resource)).toThrow('역할을 변경할 권한이 없습니다'));
    it('SUPER는 bypass', () => expect(() => policy.authorizeChangeRole(superUser, resource)).not.toThrow());
  });
});
