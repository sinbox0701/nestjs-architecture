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
  type?: string;
}

function makeContext({ user, type = 'http' }: MockOpts) {
  return {
    getType: () => type,
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
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
const user: AuthSubject = { id: 1, jti: 'j', globalRoles: [], teams: [{ teamId: 7, role: 'MEMBER' }] };

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
    expect(() => guard.canActivate(makeContext({ user }))).toThrow();
  });

  it('인증 주체가 없으면 거부한다', () => {
    const { guard } = makeGuard({ requires: REQ }, true);
    expect(() => guard.canActivate(makeContext({ requires: REQ }))).toThrow();
  });

  it('SUPER globalRole은 즉시 통과한다(매트릭스 호출 없음)', () => {
    const sup: AuthSubject = { id: 1, jti: 'j', globalRoles: [GlobalRole.SUPER], teams: [] };
    const { guard, provider } = makeGuard({ requires: REQ }, false);
    expect(guard.canActivate(makeContext({ requires: REQ, user: sup }))).toBe(true);
    expect(provider.can).not.toHaveBeenCalled();
  });

  it('매트릭스가 허용하면 통과(주체 컨텍스트로 호출), 거부하면 throw', () => {
    const allow = makeGuard({ requires: REQ }, true);
    expect(allow.guard.canActivate(makeContext({ requires: REQ, user }))).toBe(true);
    expect(allow.provider.can).toHaveBeenCalledWith(user, Action.UPDATE, 'scenario');

    const deny = makeGuard({ requires: REQ }, false);
    expect(() => deny.guard.canActivate(makeContext({ requires: REQ, user }))).toThrow();
  });
});
