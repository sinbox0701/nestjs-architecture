import {
  Action,
  DenyAllAccessPolicyProvider,
  RoleActionMatrix,
  StaticAccessPolicyProvider,
} from '@/lib/access-control';

describe('StaticAccessPolicyProvider', () => {
  const matrix: RoleActionMatrix = {
    OWNER: { '*': [Action.MANAGE] }, // 모든 리소스, 모든 액션
    MANAGER: { scenario: [Action.CREATE, Action.READ, Action.UPDATE] },
    MEMBER: { scenario: [Action.READ] },
  };
  const provider = new StaticAccessPolicyProvider(matrix);

  it('MANAGE 와일드카드는 모든 액션을 허용한다', () => {
    expect(provider.can('OWNER', Action.DELETE, 'scenario')).toBe(true);
    expect(provider.can('OWNER', 'order:cancel', 'anything')).toBe(true);
  });

  it("리소스 '*' 와일드카드가 적용된다", () => {
    expect(provider.can('OWNER', Action.READ, 'report')).toBe(true);
  });

  it('명시된 (역할, 액션, 리소스)만 허용한다', () => {
    expect(provider.can('MANAGER', Action.UPDATE, 'scenario')).toBe(true);
    expect(provider.can('MEMBER', Action.READ, 'scenario')).toBe(true);
  });

  it('명시되지 않은 액션은 거부한다', () => {
    expect(provider.can('MANAGER', Action.DELETE, 'scenario')).toBe(false);
    expect(provider.can('MEMBER', Action.UPDATE, 'scenario')).toBe(false);
  });

  it('알 수 없는 역할/리소스는 거부한다', () => {
    expect(provider.can('GHOST', Action.READ, 'scenario')).toBe(false);
    expect(provider.can('MEMBER', Action.READ, 'unknown')).toBe(false);
  });
});

describe('DenyAllAccessPolicyProvider', () => {
  it('항상 거부한다(default-deny)', () => {
    const provider = new DenyAllAccessPolicyProvider();
    expect(provider.can('OWNER', Action.READ, 'scenario')).toBe(false);
  });
});
