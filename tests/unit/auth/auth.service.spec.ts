import { ConfigService } from '@nestjs/config';

import { GlobalRole } from '@/lib/access-control';
import { RedisClient } from '@/lib/redis/redis.client';
import { AuthService } from '@/modules/auth/auth.service';
import { RefreshTokenStore } from '@/modules/auth/refresh-token.store';
import { SessionEpochStore } from '@/modules/auth/session-epoch.store';
import { TokenService } from '@/modules/auth/token.service';
import { AuthIdentity, UserCredentialPort } from '@/modules/auth/user-credential.port';
import { TeamPosition } from '@/modules/identity/enum/team-position.enum';

const identity: AuthIdentity = {
  id: 42,
  globalRoles: [GlobalRole.SUPER],
  role: { id: 3, name: 'Red' },
  team: { id: 7, position: TeamPosition.LEADER },
};

function build(redisOverrides: Partial<Record<string, jest.Mock>> = {}) {
  const users = { validateCredentials: jest.fn(), getIdentity: jest.fn() };
  const token = {
    signAccessToken: jest.fn().mockResolvedValue({ token: 'at', jti: 'j1' }),
    signRefreshToken: jest.fn().mockResolvedValue('rt'),
  };
  const refreshStore = {
    issue: jest.fn().mockResolvedValue({ family: 'f1', jti: 'r1' }),
    revokeAllFamilies: jest.fn().mockResolvedValue(undefined),
  };
  const sessionEpoch = { current: jest.fn().mockResolvedValue(0), revokeAll: jest.fn().mockResolvedValue(1) };
  const redis = {
    safeGet: jest.fn().mockResolvedValue(null),
    safeIncr: jest.fn().mockResolvedValue(1),
    safeExpire: jest.fn().mockResolvedValue(undefined),
    safeDel: jest.fn().mockResolvedValue(undefined),
    ...redisOverrides,
  };
  const config = {
    getOrThrow: jest.fn((key: string) => (key === 'auth.maxLoginAttempts' ? 5 : 30)),
  };
  const service = new AuthService(
    users as unknown as UserCredentialPort,
    token as unknown as TokenService,
    refreshStore as unknown as RefreshTokenStore,
    sessionEpoch as unknown as SessionEpochStore,
    redis as unknown as RedisClient,
    config as unknown as ConfigService,
  );
  return { service, users, token, refreshStore, sessionEpoch, redis, config };
}

describe('AuthService.login — 계정 lockout', () => {
  it('누적 실패가 임계(max)에 도달하면 자격 검증 전에 ACCOUNT_LOCKED로 막는다', async () => {
    const { service, users, redis } = build({ safeGet: jest.fn().mockResolvedValue('5') });

    await expect(service.login('a@b.com', 'pw')).rejects.toMatchObject({ message: expect.any(String) });
    // 잠긴 상태면 자격 검증을 시도하지 않는다.
    expect(users.validateCredentials).not.toHaveBeenCalled();
    expect(redis.safeGet).toHaveBeenCalledWith('login:fail:a@b.com');
  });

  it('자격 실패 시 실패 카운터를 올리고(첫 실패엔 TTL) INVALID_CREDENTIALS를 던진다', async () => {
    const { service, users, redis } = build();
    users.validateCredentials.mockResolvedValue(null);

    await expect(service.login('A@B.com ', 'pw')).rejects.toMatchObject({ message: expect.any(String) });
    // email은 정규화(trim+lowercase)되어 키로 쓰인다.
    expect(redis.safeIncr).toHaveBeenCalledWith('login:fail:a@b.com');
    expect(redis.safeExpire).toHaveBeenCalledWith('login:fail:a@b.com', 30 * 60); // lockDurationMinutes*60
  });

  it('로그인 성공 시 실패 카운터를 초기화하고 토큰을 발급한다', async () => {
    const { service, users, redis, token } = build();
    users.validateCredentials.mockResolvedValue(identity);

    const issued = await service.login('a@b.com', 'pw');

    expect(redis.safeDel).toHaveBeenCalledWith('login:fail:a@b.com');
    expect(token.signAccessToken).toHaveBeenCalled();
    expect(issued.accessToken).toBe('at');
  });
});

describe('AuthService — 세션 epoch 무효화', () => {
  it('로그인 시 현재 epoch를 조회해 AT 발급에 싣는다', async () => {
    const { service, users, sessionEpoch, token } = build();
    users.validateCredentials.mockResolvedValue(identity);
    sessionEpoch.current.mockResolvedValue(7);

    await service.login('a@b.com', 'pw');

    expect(sessionEpoch.current).toHaveBeenCalledWith(identity.id);
    expect(token.signAccessToken).toHaveBeenCalledWith(identity, 7); // epoch가 토큰 서명에 전달된다
  });

  it('revokeAllSessions는 epoch를 올리고(기존 AT 무효) RT family도 폐기한다(refresh 우회 차단)', async () => {
    const { service, sessionEpoch, refreshStore } = build();

    await service.revokeAllSessions(42);

    expect(sessionEpoch.revokeAll).toHaveBeenCalledWith(42);
    expect(refreshStore.revokeAllFamilies).toHaveBeenCalledWith(42);
  });
});
