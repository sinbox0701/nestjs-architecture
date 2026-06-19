import {
  Action,
  AuthSubject,
  DenyAllAccessPolicyProvider,
  RoleActionMatrix,
  RoleResolver,
  StaticAccessPolicyProvider,
} from '@/lib/access-control';

/** 테스트용: 주체의 `roles` 필드를 매트릭스 키로 추출(도메인은 권한팀 이름 등으로 대체). */
const resolveRoles: RoleResolver = (s: AuthSubject) => (s.roles as string[] | undefined) ?? [];
const subject = (...roles: string[]): AuthSubject => ({ id: 1, jti: 'j', globalRoles: [], teams: [], roles });

describe('StaticAccessPolicyProvider', () => {
  const matrix: RoleActionMatrix = {
    OWNER: { '*': [Action.MANAGE] }, // 모든 리소스, 모든 액션
    MANAGER: { scenario: [Action.CREATE, Action.READ, Action.UPDATE] },
    MEMBER: { scenario: [Action.READ] },
  };
  const provider = new StaticAccessPolicyProvider(matrix, resolveRoles);

  it('MANAGE 와일드카드는 모든 액션을 허용한다', () => {
    expect(provider.can(subject('OWNER'), Action.DELETE, 'scenario')).toBe(true);
    expect(provider.can(subject('OWNER'), 'order:cancel', 'anything')).toBe(true);
  });

  it("리소스 '*' 와일드카드가 적용된다", () => {
    expect(provider.can(subject('OWNER'), Action.READ, 'report')).toBe(true);
  });

  it('명시된 (역할, 액션, 리소스)만 허용한다', () => {
    expect(provider.can(subject('MANAGER'), Action.UPDATE, 'scenario')).toBe(true);
    expect(provider.can(subject('MEMBER'), Action.READ, 'scenario')).toBe(true);
  });

  it('명시되지 않은 액션은 거부한다', () => {
    expect(provider.can(subject('MANAGER'), Action.DELETE, 'scenario')).toBe(false);
    expect(provider.can(subject('MEMBER'), Action.UPDATE, 'scenario')).toBe(false);
  });

  it('알 수 없는 역할/리소스/역할없음은 거부한다', () => {
    expect(provider.can(subject('GHOST'), Action.READ, 'scenario')).toBe(false);
    expect(provider.can(subject('MEMBER'), Action.READ, 'unknown')).toBe(false);
    expect(provider.can(subject(), Action.READ, 'scenario')).toBe(false);
  });

  it('여러 역할 중 하나라도 허용하면 통과한다', () => {
    expect(provider.can(subject('MEMBER', 'MANAGER'), Action.UPDATE, 'scenario')).toBe(true);
  });
});

describe('DenyAllAccessPolicyProvider', () => {
  it('항상 거부한다(default-deny)', () => {
    const provider = new DenyAllAccessPolicyProvider();
    expect(provider.can(subject('OWNER'), Action.READ, 'scenario')).toBe(false);
  });
});
