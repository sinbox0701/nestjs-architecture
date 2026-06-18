import { Global, Module } from '@nestjs/common';

import { RedisClient } from './redis.client';

/**
 * Redis Module
 *
 * Redis 클라이언트를 제공하는 NestJS 모듈
 * - lib/ 패턴: 기술적 인프라 제공
 * - 비즈니스 로직 무관
 */
@Global()
@Module({
  providers: [RedisClient],
  exports: [RedisClient],
})
export class RedisModule {}
