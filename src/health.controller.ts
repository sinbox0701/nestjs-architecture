import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/postgresql';

import { Public } from './common/decorators/auth-public.decorator';
import { FrameworkLogger } from './core/logger/framework-logger';
import { RedisClient } from './lib/redis/redis.client';

@Controller('/')
export class HealthController {
  private readonly logger = new FrameworkLogger(HealthController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly em: EntityManager,
    private readonly redis: RedisClient,
  ) {}

  /** 기본 헬스 체크. 인증 없이 접근 가능. */
  @Get('health-check')
  @Public()
  healthCheck(): string {
    return this.configService.get<string>('APP_NAME', 'backend-template');
  }

  /** DB·Redis 연결까지 검증. 하나라도 실패하면 503. */
  @Get('health-check/full')
  @Public()
  async healthCheckFull() {
    const errors: string[] = [];
    let db: 'ok' | 'down' = 'down';
    let redis: 'ok' | 'down' = 'down';

    try {
      await this.em.getConnection().execute('SELECT 1');
      db = 'ok';
    } catch (e) {
      this.logger.error(`DB health check failed: ${(e as Error).message}`, (e as Error).stack);
      errors.push('db: unavailable');
    }

    try {
      const pong = await this.redis.ping();
      if (pong) {
        redis = 'ok';
      } else {
        this.logger.error('Redis health check returned empty response');
        errors.push('redis: unavailable');
      }
    } catch (e) {
      this.logger.error(`Redis health check failed: ${(e as Error).message}`, (e as Error).stack);
      errors.push('redis: unavailable');
    }

    const payload = { db, redis, timestamp: new Date().toISOString() };

    if (errors.length > 0) {
      throw new ServiceUnavailableException({ status: 'not_ready', ...payload, errors });
    }

    return { status: 'ok', ...payload };
  }
}
