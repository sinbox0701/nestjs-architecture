import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { randomUUID } from 'crypto';

import { parseDurationToSeconds } from '@/common/utils/time.util';
import { RedisClient } from '@/lib/redis/redis.client';

import { REFRESH_STORE_PREFIX } from './auth.constants';
import { AUTH_EXCEPTIONS } from './exception/auth.exception';

/**
 * Refresh Token 저장소 (Redis). family 단위로 현재 유효한 RT jti 하나만 보관한다.
 * - rotation: refresh마다 새 jti로 교체 → 옛 RT는 무효.
 * - 재사용 탐지: 보관된 jti와 다른(=이미 회전된) RT가 들어오면 family 전체 폐기(탈취 신호).
 */
@Injectable()
export class RefreshTokenStore {
  constructor(
    private readonly redis: RedisClient,
    private readonly configService: ConfigService,
  ) {}

  private key(userId: number, family: string): string {
    return `${REFRESH_STORE_PREFIX}${userId}:${family}`;
  }

  private ttlSeconds(): number {
    return parseDurationToSeconds(this.configService.getOrThrow<string>('auth.refreshExpiresIn'));
  }

  /** 새 family + jti 발급(로그인). */
  async issue(userId: number): Promise<{ family: string; jti: string }> {
    const family = randomUUID();
    const jti = randomUUID();
    await this.redis.set(this.key(userId, family), jti, 'EX', this.ttlSeconds());
    return { family, jti };
  }

  /** rotation. 유효하지 않거나 재사용이면 throw. 통과 시 새 jti 반환. */
  async rotate(userId: number, family: string, presentedJti: string): Promise<string> {
    const key = this.key(userId, family);
    const stored = await this.redis.get(key);

    if (!stored) {
      throw AUTH_EXCEPTIONS.INVALID_REFRESH_TOKEN();
    }
    if (stored !== presentedJti) {
      // 이미 회전된(옛) RT가 다시 들어옴 = 탈취 의심 → family 폐기.
      await this.redis.del(key);
      throw AUTH_EXCEPTIONS.REFRESH_TOKEN_REUSED();
    }

    const newJti = randomUUID();
    await this.redis.set(key, newJti, 'EX', this.ttlSeconds());
    return newJti;
  }

  /** family 폐기(로그아웃). */
  async revoke(userId: number, family: string): Promise<void> {
    await this.redis.del(this.key(userId, family));
  }
}
