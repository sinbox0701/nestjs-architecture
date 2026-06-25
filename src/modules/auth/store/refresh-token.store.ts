import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { randomUUID } from 'crypto';

import { parseDurationToSeconds } from '@/common/utils/time.util';
import { FrameworkLogger } from '@/core/logger/framework-logger';
import { RedisClient } from '@/lib/redis/redis.client';

import { REFRESH_STORE_PREFIX } from '../auth.constants';
import { AUTH_EXCEPTIONS } from '../exception/auth.exception';

/**
 * Refresh Token 저장소 (Redis). family 단위로 현재 유효한 RT jti 하나만 보관한다.
 * - rotation: refresh마다 새 jti로 교체 → 옛 RT는 무효.
 * - 재사용 탐지: 보관된 jti와 다른(=이미 회전된) RT가 들어오면 family 전체 폐기(탈취 신호).
 */
@Injectable()
export class RefreshTokenStore {
  private readonly logger = new FrameworkLogger(RefreshTokenStore.name);

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
    const newJti = randomUUID();

    // CAS로 "저장 jti == 제시 jti일 때만 새 jti로 교체"를 원자적으로 한다. 동시 refresh 시
    // GET→SET 사이 race(둘 다 통과해 각자 덮어쓰기)를 막아 재사용 탐지 신뢰성을 보장한다.
    const swapped = await this.redis.compareAndSet(key, presentedJti, newJti, this.ttlSeconds());
    if (swapped) {
      return newJti;
    }

    // 교체 실패: 키가 아직 있으면 jti 불일치(이미 회전된 옛 RT 재사용 = 탈취 의심) → family 폐기.
    // 키가 없으면 만료/무효.
    const stored = await this.redis.get(key);
    if (stored) {
      await this.redis.del(key);
      this.logger.warn(`refresh token reuse detected (token theft 의심) userId=${userId} family=${family}`);
      throw AUTH_EXCEPTIONS.REFRESH_TOKEN_REUSED();
    }
    throw AUTH_EXCEPTIONS.INVALID_REFRESH_TOKEN();
  }

  /** family 폐기(로그아웃). */
  async revoke(userId: number, family: string): Promise<void> {
    await this.redis.del(this.key(userId, family));
  }

  /**
   * 사용자의 모든 RT family 폐기(권한 회수/추방 시). `rt:{userId}:*`를 전부 삭제한다.
   * 세션 epoch 무효화(기존 AT 차단)와 짝을 이뤄 `@Public` refresh 경로로 새 AT를 재발급받는 우회를 막는다.
   */
  async revokeAllFamilies(userId: number): Promise<void> {
    const keys = await this.redis.safeKeys(`${REFRESH_STORE_PREFIX}${userId}:*`);
    if (keys.length > 0) {
      await this.redis.safeDel(...keys);
    }
  }
}
