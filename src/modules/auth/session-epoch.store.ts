import { Injectable } from '@nestjs/common';

import { FrameworkLogger } from '@/core/logger/framework-logger';
import { RedisClient } from '@/lib/redis/redis.client';

import { SESSION_EPOCH_PREFIX } from './auth.constants';

/**
 * 세션 epoch 저장소 (Redis) — 사용자 단위 토큰 무효화.
 *
 * 발급 시 현재 epoch를 AT 클레임에 싣고, AuthGuard가 매 요청 저장된 epoch와 대조한다.
 * 권한 강등·추방 등 "지금 즉시" 무효화가 필요할 때 `revokeAll(userId)`로 epoch를 올리면
 * 그 사용자의 기존 AT가 다음 요청부터 전부 거부된다(blocklist의 jti 단위와 달리 사용자 단위).
 *
 * 조회/증가 모두 `safe*`라 Redis 장애 시 fail-open(epoch 0으로 간주 → 기존 동작과 동일).
 */
@Injectable()
export class SessionEpochStore {
  private readonly logger = new FrameworkLogger(SessionEpochStore.name);

  constructor(private readonly redis: RedisClient) {}

  private key(userId: number): string {
    return `${SESSION_EPOCH_PREFIX}${userId}`;
  }

  /** 현재 epoch. 미설정이면 0. */
  async current(userId: number): Promise<number> {
    const value = await this.redis.safeGet(this.key(userId));
    const epoch = value ? Number(value) : 0;
    return Number.isFinite(epoch) ? epoch : 0;
  }

  /**
   * 사용자의 모든 기존 세션 무효화(epoch +1). 권한 회수·추방·비밀번호 변경 등에서 호출한다.
   * 반환: 증가된 epoch(Redis 장애 시 -1 — 무효화가 적용되지 않았음을 의미).
   */
  async revokeAll(userId: number): Promise<number> {
    const epoch = await this.redis.safeIncr(this.key(userId));
    this.logger.log(`session epoch bumped userId=${userId} epoch=${epoch}`);
    return epoch;
  }
}
