import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '@/common/decorators/auth-public.decorator';
import {
  AccessPolicyProvider,
  Action,
  AuthSubject,
  GlobalRole,
  PolicyGuard,
  RequiresMetadata,
} from '@/lib/access-control';

interface MockOpts {
  isPublic?: boolean;
  requires?: RequiresMetadata;
  user?: AuthSubject;
  params?: Record<string, string>;
  type?: string;
}

function makeContext({ user, params = {}, type = 'http' }: MockOpts) {
  return {
    getType: () => type,
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user, params }) }),
  } as unknown as ExecutionContext;
}

function makeReflector({ isPublic, requires }: MockOpts): Reflector {
  return {
    getAllAndOverride: jest.fn((key: string) => (key === IS_PUBLIC_KEY ? isPublic : requires)),
  } as unknown as Reflector;
}

function makeGuard(opts: MockOpts, can: boolean) {
  const provider: AccessPolicyProvider = { can: jest.fn(() => can) };
  const guard = new PolicyGuard(makeReflector(opts), provider);
  return { guard, provider };
}

const REQ: RequiresMetadata = { action: Action.UPDATE, resourceType: 'scenario' };
const member: AuthSubject = { id: 1, jti: 'j', globalRoles: [], teams: [{ teamId: 7, role: 'MEMBER' }] };

describe('PolicyGuard', () => {
  it('http가 아니면 통과한다', () => {
    const { guard } = makeGuard({ type: 'ws' }, false);
    expect(guard.canActivate(makeContext({ type: 'ws' }))).toBe(true);
  });

  it('@Public이면 통과한다', () => {
    const { guard } = makeGuard({ isPublic: true }, false);
    expect(guard.canActivate(makeContext({ isPublic: true }))).toBe(true);
  });

  it('@Requires가 없으면 거부한다(default-deny)', () => {
    const { guard } = makeGuard({}, true);
    expect(() => guard.canActivate(makeContext({ user: member }))).toThrow();
  });

  it('SUPER globalRole은 즉시 통과한다', () => {
    const sup: AuthSubject = { id: 1, jti: 'j', globalRoles: [GlobalRole.SUPER], teams: [] };
    const { guard, provider } = makeGuard({ requires: REQ }, false);
    expect(guard.canActivate(makeContext({ requires: REQ, user: sup, params: {} }))).toBe(true);
    expect(provider.can).not.toHaveBeenCalled();
  });

  it('teamId를 확인할 수 없으면 거부한다', () => {
    const { guard } = makeGuard({ requires: REQ }, true);
    expect(() => guard.canActivate(makeContext({ requires: REQ, user: member, params: {} }))).toThrow();
  });

  it('해당 팀 멤버십이 없으면 거부한다', () => {
    const { guard } = makeGuard({ requires: REQ }, true);
    expect(() => guard.canActivate(makeContext({ requires: REQ, user: member, params: { teamId: '999' } }))).toThrow();
  });

  it('매트릭스가 허용하면 통과, 거부하면 throw', () => {
    const allow = makeGuard({ requires: REQ }, true);
    expect(allow.guard.canActivate(makeContext({ requires: REQ, user: member, params: { teamId: '7' } }))).toBe(true);
    expect(allow.provider.can).toHaveBeenCalledWith('MEMBER', Action.UPDATE, 'scenario');

    const deny = makeGuard({ requires: REQ }, false);
    expect(() =>
      deny.guard.canActivate(makeContext({ requires: REQ, user: member, params: { teamId: '7' } })),
    ).toThrow();
  });

  it('커스텀 teamId 추출자를 사용한다', () => {
    const req: RequiresMetadata = {
      action: Action.READ,
      resourceType: 'scenario',
      options: { teamId: () => 7 },
    };
    const { guard } = makeGuard({ requires: req }, true);
    expect(guard.canActivate(makeContext({ requires: req, user: member, params: {} }))).toBe(true);
  });

  it('비정규 teamId(공백/16진수/소수)는 거부한다', () => {
    const { guard } = makeGuard({ requires: REQ }, true);
    for (const teamId of [' 7 ', '0x7', '7.0', '7e0', '']) {
      expect(() => guard.canActivate(makeContext({ requires: REQ, user: member, params: { teamId } }))).toThrow();
    }
  });
});
