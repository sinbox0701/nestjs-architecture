import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { GlobalRole } from '@/lib/access-control';
import { TokenService } from '@/modules/auth/token.service';
import { AuthIdentity } from '@/modules/auth/user-credential.port';
import { TeamPosition } from '@/modules/identity/enum/team-position.enum';

interface MockJwt {
  signAsync: jest.Mock;
}

function buildMockJwt(overrides: Partial<MockJwt> = {}): MockJwt {
  return {
    signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
    ...overrides,
  };
}

const identity: AuthIdentity = {
  id: 42,
  globalRoles: [GlobalRole.SUPER],
  role: { id: 3, name: 'Red' },
  team: { id: 7, position: TeamPosition.LEADER },
};

describe('TokenService.signAccessToken', () => {
  let jwt: MockJwt;
  let service: TokenService;

  beforeEach(() => {
    jwt = buildMockJwt();
    service = new TokenService(jwt as unknown as JwtService, {} as ConfigService);
  });

  it('access token 페이로드를 AuthIdentity로 구성한다', async () => {
    const { token, jti } = await service.signAccessToken(identity);

    expect(token).toBe('signed.jwt.token');
    expect(jti).toEqual(expect.any(String));

    const payload = jwt.signAsync.mock.calls[0][0];
    expect(payload).toMatchObject({
      sub: 42,
      jti,
      globalRoles: [GlobalRole.SUPER],
      role: { id: 3, name: 'Red' },
    });
  });

  it('teams[].role 슬롯에 소속팀 직위(position)를 싣는다', async () => {
    await service.signAccessToken(identity);
    const payload = jwt.signAsync.mock.calls[0][0];

    // Tier1 capability는 role.name으로, Tier2 직위는 teams[].role 슬롯으로 분리되어 실린다.
    expect(payload.teams).toEqual([{ teamId: 7, role: TeamPosition.LEADER }]);
  });

  it('jti는 발급마다 달라진다(blocklist 키)', async () => {
    const a = await service.signAccessToken(identity);
    const b = await service.signAccessToken(identity);
    expect(a.jti).not.toBe(b.jti);
  });
});
