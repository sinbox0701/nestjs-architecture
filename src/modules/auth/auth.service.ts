import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { parseDurationToSeconds } from '@/common/utils/time.util';
import { FrameworkLogger } from '@/core/logger/framework-logger';
import { RedisClient } from '@/lib/redis/redis.client';

import { BLOCKLIST_PREFIX } from './auth.constants';
import { AUTH_EXCEPTIONS } from './exception/auth.exception';
import { RefreshTokenStore } from './refresh-token.store';
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
    private readonly redis: RedisClient,
    private readonly configService: ConfigService,
  ) {}

  /** 로그인: 자격 검증 → AT + RT(family) 발급. */
  async login(email: string, password: string): Promise<IssuedTokens> {
    const identity = await this.users.validateCredentials(email, password);
    if (!identity) {
      throw AUTH_EXCEPTIONS.INVALID_CREDENTIALS();
    }
    const { family, jti } = await this.refreshStore.issue(identity.id);
    const access = await this.token.signAccessToken(identity);
    const refreshToken = await this.token.signRefreshToken(identity.id, family, jti);
    this.logger.log(`login userId=${identity.id} teamId=${identity.team.id}`);
    return { accessToken: access.token, refreshToken, identity };
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

    const access = await this.token.signAccessToken(identity);
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
