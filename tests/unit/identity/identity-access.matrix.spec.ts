import { Action, AuthSubject, StaticAccessPolicyProvider } from '@/lib/access-control';
import { IDENTITY_ROLE_MATRIX, resolveAccessRoles } from '@/modules/identity/access/identity-access.matrix';

/** AuthSubject + 역할 클레임(JWT payload에서 spread되는 형태). */
function subjectWithRole(name?: string): AuthSubject {
  return { id: 1, jti: 'j', globalRoles: [], teams: [], ...(name ? { role: { id: 1, name } } : {}) };
}

describe('resolveAccessRoles — 매트릭스 키 추출', () => {
  it('역할 이름을 대문자 정규화해 키로 추출한다', () => {
    expect(resolveAccessRoles(subjectWithRole('Red'))).toEqual(['RED']);
    expect(resolveAccessRoles(subjectWithRole('blue'))).toEqual(['BLUE']); // 소문자도 매칭
  });

  it('역할이 없으면 빈 배열(→ default-deny)', () => {
    expect(resolveAccessRoles(subjectWithRole())).toEqual([]);
  });
});

describe('IDENTITY_ROLE_MATRIX (Tier1 capability)', () => {
  const provider = new StaticAccessPolicyProvider(IDENTITY_ROLE_MATRIX, resolveAccessRoles);

  it('Red는 user를 전부 관리(MANAGE → 모든 액션)', () => {
    const red = subjectWithRole('Red');
    expect(provider.can(red, Action.CREATE, 'user')).toBe(true);
    expect(provider.can(red, Action.DELETE, 'user')).toBe(true);
  });

  it('Blue는 user 읽기만 가능', () => {
    const blue = subjectWithRole('Blue');
    expect(provider.can(blue, Action.READ, 'user')).toBe(true);
    expect(provider.can(blue, Action.CREATE, 'user')).toBe(false);
    expect(provider.can(blue, Action.UPDATE, 'user')).toBe(false);
  });

  it('team / role 리소스는 어떤 역할에도 미부여(→ SUPER 전용)', () => {
    expect(provider.can(subjectWithRole('Red'), Action.CREATE, 'team')).toBe(false);
    expect(provider.can(subjectWithRole('Red'), Action.CREATE, 'role')).toBe(false);
  });

  it('매트릭스에 없는 역할은 default-deny', () => {
    expect(provider.can(subjectWithRole('Green'), Action.READ, 'user')).toBe(false);
    expect(provider.can(subjectWithRole(), Action.READ, 'user')).toBe(false);
  });
});
