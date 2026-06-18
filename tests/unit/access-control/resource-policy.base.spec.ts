import { Action, AuthSubject, GlobalRole, loadAndAuthorize, ResourcePolicy, TeamScoped } from '@/lib/access-control';

interface Scenario extends TeamScoped {
  team: { id: number };
}

class ScenarioPolicy extends ResourcePolicy<Scenario> {
  canCreate(actor: AuthSubject, ctx: { teamId: number }): boolean {
    return this.membership(actor, ctx.teamId)?.role === this.ownerRole;
  }
  canRead(actor: AuthSubject, resource: Scenario): boolean {
    return this.isTeamMember(actor, resource);
  }
  canUpdate(actor: AuthSubject, resource: Scenario): boolean {
    return this.isTeamOwner(actor, resource);
  }
  canDelete(actor: AuthSubject, resource: Scenario): boolean {
    return this.isTeamOwner(actor, resource);
  }
}

const policy = new ScenarioPolicy();
const resource: Scenario = { team: { id: 7 } };

const owner: AuthSubject = { id: 1, jti: 'j', globalRoles: [], teams: [{ teamId: 7, role: 'OWNER' }] };
const member: AuthSubject = { id: 2, jti: 'j', globalRoles: [], teams: [{ teamId: 7, role: 'MEMBER' }] };
const outsider: AuthSubject = { id: 3, jti: 'j', globalRoles: [], teams: [{ teamId: 9, role: 'OWNER' }] };
const sup: AuthSubject = { id: 4, jti: 'j', globalRoles: [GlobalRole.SUPER], teams: [] };

describe('ResourcePolicy 헬퍼', () => {
  it('isTeamMember는 같은 팀 소속이면 true', () => {
    expect(policy.canRead(member, resource)).toBe(true);
    expect(policy.canRead(outsider, resource)).toBe(false);
  });

  it('isTeamOwner는 OWNER 역할일 때만 true', () => {
    expect(policy.canUpdate(owner, resource)).toBe(true);
    expect(policy.canUpdate(member, resource)).toBe(false);
  });
});

describe('ResourcePolicy.authorize', () => {
  it('허용되면 통과, 거부되면 ForbiddenException', () => {
    expect(() => policy.authorize(owner, Action.UPDATE, resource)).not.toThrow();
    expect(() => policy.authorize(member, Action.UPDATE, resource)).toThrow();
    expect(() => policy.authorize(member, Action.READ, resource)).not.toThrow();
  });

  it('SUPER는 멤버가 아니어도 bypass된다', () => {
    expect(() => policy.authorize(sup, Action.DELETE, resource)).not.toThrow();
  });
});

describe('ResourcePolicy.authorizeCreate', () => {
  it('OWNER만 생성 가능', () => {
    expect(() => policy.authorizeCreate(owner, { teamId: 7 })).not.toThrow();
    expect(() => policy.authorizeCreate(member, { teamId: 7 })).toThrow();
    expect(() => policy.authorizeCreate(sup, { teamId: 7 })).not.toThrow();
  });
});

describe('loadAndAuthorize', () => {
  const loader = () => Promise.resolve(resource);

  it('로드 후 인가 통과하면 엔티티 반환', async () => {
    await expect(loadAndAuthorize(loader, policy, owner, Action.UPDATE, 7)).resolves.toBe(resource);
  });

  it('인가 실패하면 ForbiddenException (엔티티 반환 안 함)', async () => {
    await expect(loadAndAuthorize(loader, policy, member, Action.UPDATE, 7)).rejects.toThrow();
  });
});
