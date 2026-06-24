import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { parseDurationToSeconds } from '@/common/utils/time.util';
import { FrameworkLogger } from '@/core/logger/framework-logger';
import { RedisClient } from '@/lib/redis/redis.client';

import { BLOCKLIST_PREFIX, LOGIN_FAIL_PREFIX } from './auth.constants';
import { AUTH_EXCEPTIONS } from './exception/auth.exception';
import { RefreshTokenStore } from './refresh-token.store';
import { SessionEpochStore } from './session-epoch.store';
import { RefreshTokenPayload, TokenService } from './token.service';
import { AuthIdentity, USER_CREDENTIAL_PORT, UserCredentialPort } from './user-credential.port';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  identity: AuthIdentity;
}

/**
 * 인증 유스케이스: 로그인 / refresh(rotation) / 로그아웃.
 * User 엔티티는 모른다 — `UserCredentialPort`(Phase B에서 User 모듈이 구현)에만 의존한다.
 */
@Injectable()
export class AuthService {
  private readonly logger = new FrameworkLogger(AuthService.name);

  constructor(
    @Inject(USER_CREDENTIAL_PORT) private readonly users: UserCredentialPort,
    private readonly token: TokenService,
    private readonly refreshStore: RefreshTokenStore,
    private readonly sessionEpoch: SessionEpochStore,
    private readonly redis: RedisClient,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 로그인: (잠금 확인) → 자격 검증 → AT + RT(family) 발급.
   *
   * IP 기반 ThrottlerGuard(분당 5회) 위에, 계정(email) 단위 lockout을 더한다 — 분산 IP
   * credential stuffing 완화. 카운터는 Redis. Redis 장애 시 safe* 가 fail-open(throttler가 1차 방어).
   */
  async login(email: string, password: string): Promise<IssuedTokens> {
    const normalizedEmail = email.trim().toLowerCase();
    await this.assertNotLocked(normalizedEmail);

    const identity = await this.users.validateCredentials(email, password);
    if (!identity) {
      const attempts = await this.recordFailedAttempt(normalizedEmail);
      this.logger.warn(`login failed email=${normalizedEmail} attempts=${attempts}`); // 무차별 대입 탐지용 감사 로그
      throw AUTH_EXCEPTIONS.INVALID_CREDENTIALS();
    }

    await this.clearFailedAttempts(normalizedEmail);
    const { family, jti } = await this.refreshStore.issue(identity.id);
    const epoch = await this.sessionEpoch.current(identity.id);
    const access = await this.token.signAccessToken(identity, epoch);
    const refreshToken = await this.token.signRefreshToken(identity.id, family, jti);
    this.logger.log(`login userId=${identity.id} teamId=${identity.team.id}`);
    return { accessToken: access.token, refreshToken, identity };
  }

  /**
   * 사용자의 모든 활성 세션 무효화. 권한 강등·추방·비밀번호 변경 등에서 호출한다.
   * ① 세션 epoch +1 → 기존 AT가 다음 요청부터 거부. ② RT family 전부 폐기 → `@Public` refresh로
   * 새 AT를 재발급받는 우회까지 차단. 둘을 함께 해야 "사용자 단위 무효화"가 완결된다.
   */
  async revokeAllSessions(userId: number): Promise<void> {
    await this.sessionEpoch.revokeAll(userId);
    await this.refreshStore.revokeAllFamilies(userId);
    this.logger.log(`revokeAllSessions userId=${userId}`);
  }

  private loginFailKey(email: string): string {
    return `${LOGIN_FAIL_PREFIX}${email}`;
  }

  /** 누적 실패가 max 이상이면 잠금(429). Redis 장애 시 카운터는 비활성(fail-open). */
  private async assertNotLocked(email: string): Promise<void> {
    const max = this.configService.getOrThrow<number>('auth.maxLoginAttempts');
    const attempts = Number((await this.redis.safeGet(this.loginFailKey(email))) ?? 0);
    if (attempts >= max) {
      this.logger.warn(`login blocked (locked) email=${email} attempts=${attempts}`);
      throw AUTH_EXCEPTIONS.ACCOUNT_LOCKED();
    }
  }

  /** 실패 카운트 증가. 첫 실패에 잠금 윈도(TTL)를 건다. 반환: 현재 누적 횟수. */
  private async recordFailedAttempt(email: string): Promise<number> {
    const key = this.loginFailKey(email);
    const attempts = await this.redis.safeIncr(key); // Redis 장애 시 -1 → lockout 비활성
    if (attempts === 1) {
      const ttl = this.configService.getOrThrow<number>('auth.lockDurationMinutes') * 60;
      await this.redis.safeExpire(key, ttl);
    }
    return attempts;
  }

  private async clearFailedAttempts(email: string): Promise<void> {
    await this.redis.safeDel(this.loginFailKey(email));
  }

  /** refresh: RT 검증 + rotation(재사용 탐지) → 새 AT + RT 발급. */
  async refresh(refreshToken?: string): Promise<IssuedTokens> {
    // 쿠키 부재(undefined) 등 신뢰경계 입력을 명시 가드 — verify에 undefined를 넘기지 않는다.
    if (!refreshToken) {
      throw AUTH_EXCEPTIONS.INVALID_REFRESH_TOKEN();
    }
    let payload: RefreshTokenPayload;
    try {
      payload = await this.token.verifyRefreshToken(refreshToken);
    } catch {
      throw AUTH_EXCEPTIONS.INVALID_REFRESH_TOKEN();
    }

    const newJti = await this.refreshStore.rotate(payload.sub, payload.family, payload.jti); // 재사용 시 throw
    const identity = await this.users.getIdentity(payload.sub);
    if (!identity) {
      await this.refreshStore.revoke(payload.sub, payload.family);
      throw AUTH_EXCEPTIONS.INVALID_REFRESH_TOKEN();
    }

    const epoch = await this.sessionEpoch.current(identity.id);
    const access = await this.token.signAccessToken(identity, epoch);
    const rotated = await this.token.signRefreshToken(payload.sub, payload.family, newJti);
    this.logger.log(`refresh userId=${identity.id}`);
    return { accessToken: access.token, refreshToken: rotated, identity };
  }

  /** 로그아웃: AT를 blocklist에 등록 + RT family 폐기. 멱등(이미 만료/무효면 조용히 통과). */
  async logout(accessToken?: string, refreshToken?: string): Promise<void> {
    if (accessToken) {
      try {
        const payload = await this.token.verifyAccessToken(accessToken);
        const ttl = parseDurationToSeconds(this.configService.getOrThrow<string>('auth.jwtExpiresIn'));
        await this.redis.set(`${BLOCKLIST_PREFIX}${payload.jti}`, '1', 'EX', ttl);
        this.logger.log(`logout userId=${payload.sub} jti=${payload.jti}`);
      } catch {
        // 이미 만료/무효한 AT면 blocklist 불필요.
      }
    }
    if (refreshToken) {
      try {
        const payload = await this.token.verifyRefreshToken(refreshToken);
        await this.refreshStore.revoke(payload.sub, payload.family);
      } catch {
        // 무효 RT면 폐기할 것 없음.
      }
    }
  }
}
