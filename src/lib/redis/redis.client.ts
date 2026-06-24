import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { randomUUID } from 'crypto';
import { createClient, RedisClientType } from 'redis';

import { FrameworkLogger } from '@/core/logger/framework-logger';

// ===== Pipeline Interfaces =====

export interface RedisPipeline {
  set(key: string, value: string): RedisPipeline;
  get(key: string): RedisPipeline;
  del(...keys: string[]): RedisPipeline;
  expire(key: string, seconds: number): RedisPipeline;
  exec(): Promise<Array<[Error | null, any]>>;
}

export interface SafeRedisPipeline {
  set(key: string, value: string): SafeRedisPipeline;
  get(key: string): SafeRedisPipeline;
  del(...keys: string[]): SafeRedisPipeline;
  expire(key: string, seconds: number): SafeRedisPipeline;
  exec(): Promise<void>;
}

export type RedisMessageHandler = (message: string, channel: string) => void;

/**
 * Redis Client
 *
 * node-redis를 래핑한 Redis 클라이언트
 * - KV 작업: 메인 커넥션 사용
 * - Pub/Sub: 별도 subscriber 커넥션 사용 (Redis 제약)
 * - NestJS 생명주기에 맞춰 연결 관리
 */
@Injectable()
export class RedisClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new FrameworkLogger(this.constructor.name);
  private client: RedisClientType;
  private subscriber: RedisClientType | null = null;
  private reconnectedCallbacks: Array<() => void | Promise<void>> = [];
  private wasConnected = false;

  /** 채널별 핸들러 추적 (재연결 시 재구독용) */
  private subscriptions = new Map<string, RedisMessageHandler>();

  constructor(private readonly configService: ConfigService) {
    const fastRetries = this.configService.get<number>('REDIS_FAST_RETRIES', 5);
    const slowRetryInterval = this.configService.get<number>('REDIS_SLOW_RETRY_INTERVAL', 30000);
    const slowRetryLogInterval = this.configService.get<number>('REDIS_SLOW_RETRY_LOG_INTERVAL', 10);

    this.client = createClient({
      socket: {
        host: this.configService.get<string>('REDIS_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
        reconnectStrategy: (retries: number) => {
          // 단기 재시도: Exponential backoff (빠른 복구 대응)
          if (retries <= fastRetries) {
            const baseDelay = Math.pow(2, retries) * 100;
            const jitter = Math.random() * 100;
            const delay = Math.min(baseDelay + jitter, 5000);
            this.logger.warn(`Redis 재연결 시도 ${retries}회, ${Math.round(delay)}ms 후 재시도`);
            return delay;
          }

          // 장기 재시도: 고정 간격 (느린 복구 대응, 무제한)
          if (retries % slowRetryLogInterval === 0) {
            this.logger.warn(`Redis 장기 재연결 중... (${retries}회 시도)`);
          }
          return slowRetryInterval;
        },
      },
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      database: this.configService.get<number>('REDIS_DB', 0),
    });

    this.client.on('connect', () => {
      this.logger.log('Redis 클라이언트 연결됨');
    });

    this.client.on('ready', () => {
      this.logger.log('Redis 연결 준비 완료');

      // 재연결된 경우 콜백 실행
      if (this.wasConnected && this.reconnectedCallbacks.length > 0) {
        this.logger.log(`Redis 재연결 완료. ${this.reconnectedCallbacks.length}개의 콜백 실행 중...`);
        this.executeReconnectedCallbacks();
      }

      this.wasConnected = true;
    });

    this.client.on('reconnecting', () => {
      this.logger.log('Redis 재연결 시도 중...');
    });

    this.client.on('error', (err) => {
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        this.logger.debug('Redis 연결 불가');
      } else {
        this.logger.error('Redis 에러:', err);
      }
    });

    this.client.on('end', () => {
      this.logger.log('Redis 연결 종료');
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
      await this.client.ping();
      this.logger.log('Redis 연결 완료');
    } catch (error) {
      // REDIS_REQUIRED=true면 Redis는 필수 의존성 → 부팅을 막는다.
      // (refresh token/blocklist/session을 Redis에 두는 환경에서 조용히 뜨는 것을 방지)
      if (this.configService.get<boolean>('REDIS_REQUIRED', false)) {
        this.logger.error('Redis 연결 실패. REDIS_REQUIRED=true이므로 부팅을 중단합니다.', error);
        throw error;
      }
      this.logger.error('Redis 연결 실패. 애플리케이션은 캐시 없이 계속 동작합니다.', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.logger.log('Redis subscriber 연결 종료됨');
    }
    await this.client.quit();
    this.logger.log('Redis 연결 종료됨');
  }

  /** node-redis 커넥션이 명령을 받을 준비가 됐는지. fail-closed 분기(Redis 불가 시 거부) 판단용. */
  get isReady(): boolean {
    return this.client.isReady;
  }

  // ===== KV 메서드 =====

  async set(key: string, value: string, expiryMode?: 'EX' | 'PX', time?: number): Promise<'OK' | null> {
    if (expiryMode && time) {
      if (expiryMode === 'EX') {
        const result = await this.client.set(key, value, { EX: time });
        return result as 'OK' | null;
      }
      const result = await this.client.set(key, value, { PX: time });
      return result as 'OK' | null;
    }
    const result = await this.client.set(key, value);
    return result as 'OK' | null;
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return await this.client.del(keys);
  }

  /**
   * 패턴 매칭 키 조회 (SCAN 기반).
   *
   * ⚠️ Redis `KEYS` 명령은 단일 스레드 키스페이스 풀스캔(O(N))으로 다른 모든 요청을
   * 블로킹하므로 절대 쓰지 않는다. 대신 커서 기반 `SCAN`으로 잘게 순회한다(non-blocking).
   *
   * 주의: SCAN은 스냅샷이 아니다(순회 중 추가/삭제된 키는 누락·중복 가능). 정확한
   * 집합이 필요하거나 대량 매칭이 잦은 용도는 패턴 스캔 대신 Set/Hash 인덱스로 설계한다.
   *
   * @param pattern glob 패턴 (예: `cache:user:42:*`)
   * @param count   SCAN 1회 힌트 배치 크기 (기본 100)
   */
  async keys(pattern: string, count = 100): Promise<string[]> {
    const found: string[] = [];
    for await (const batch of this.client.scanIterator({ MATCH: pattern, COUNT: count })) {
      // node-redis v5: scanIterator는 배치(string[])를 yield한다.
      if (Array.isArray(batch)) {
        found.push(...batch);
      } else {
        found.push(batch);
      }
    }
    return found;
  }

  async exists(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return await this.client.exists(keys);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return await this.client.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  pipeline(): RedisPipeline {
    const multi = this.client.multi();
    return new RedisPipelineAdapter(multi);
  }

  async quit(): Promise<'OK'> {
    await this.client.quit();
    return 'OK';
  }

  async ping(): Promise<string> {
    return await this.client.ping();
  }

  async publish(channel: string, message: string): Promise<number> {
    return await this.client.publish(channel, message);
  }

  // ===== Pub/Sub =====

  /**
   * 채널 구독
   *
   * subscriber 전용 커넥션을 사용하며, 최초 호출 시 lazy init.
   * 재연결 시 등록된 모든 구독이 자동 복구됨.
   */
  async subscribe(channel: string, handler: RedisMessageHandler): Promise<void> {
    if (!this.subscriber) {
      await this.initSubscriber();
    }

    this.subscriptions.set(channel, handler);
    await this.subscriber!.subscribe(channel, handler);
    this.logger.log(`Redis 채널 구독: ${channel}`);
  }

  /**
   * 채널 구독 해제
   */
  async unsubscribe(channel: string): Promise<void> {
    if (!this.subscriber) return;

    this.subscriptions.delete(channel);
    await this.subscriber.unsubscribe(channel);
    this.logger.log(`Redis 채널 구독 해제: ${channel}`);
  }

  /**
   * Subscriber 전용 커넥션 초기화
   *
   * Redis Pub/Sub은 subscribe 모드 진입 시 일반 명령 사용 불가 → 별도 커넥션 필요.
   * node-redis의 duplicate()로 동일 설정의 새 커넥션 생성.
   */
  private async initSubscriber(): Promise<void> {
    this.subscriber = this.client.duplicate();

    this.subscriber.on('error', (err) => {
      this.logger.error('Redis subscriber 에러:', err);
    });

    this.subscriber.on('ready', () => {
      this.logger.log('Redis subscriber 연결 준비 완료');
    });

    await this.subscriber.connect();
    this.logger.log('Redis subscriber 커넥션 초기화 완료');
  }

  // ===== Safe 메서드들 (Redis 장애 대응) =====

  async safeGet(key: string): Promise<string | null> {
    if (!this.client.isReady) {
      this.logger.warn(`Redis not ready, skipping get for key: ${key}`);
      return null;
    }

    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.warn(`Redis get failed for key: ${key}`, error);
      return null;
    }
  }

  async safeSet(key: string, value: string, expiryMode?: 'EX' | 'PX', time?: number): Promise<void> {
    if (!this.client.isReady) {
      this.logger.warn(`Redis not ready, skipping set for key: ${key}`);
      return;
    }

    try {
      await this.set(key, value, expiryMode, time);
    } catch (error) {
      this.logger.warn(`Redis set failed for key: ${key}`, error);
    }
  }

  async safeDel(...keys: string[]): Promise<void> {
    if (!this.client.isReady) {
      this.logger.warn(`Redis not ready, skipping del for keys: ${keys.join(', ')}`);
      return;
    }

    try {
      await this.del(...keys);
    } catch (error) {
      this.logger.warn(`Redis del failed for keys: ${keys.join(', ')}`, error);
    }
  }

  async safeIncr(key: string): Promise<number> {
    if (!this.client.isReady) {
      this.logger.warn(`Redis not ready, skipping incr for key: ${key}`);
      return -1;
    }

    try {
      return await this.incr(key);
    } catch (error) {
      this.logger.warn(`Redis incr failed for key: ${key}`, error);
      return -1;
    }
  }

  async safeTtl(key: string): Promise<number> {
    if (!this.client.isReady) {
      this.logger.warn(`Redis not ready, skipping ttl for key: ${key}`);
      return -1;
    }

    try {
      return await this.ttl(key);
    } catch (error) {
      this.logger.warn(`Redis ttl failed for key: ${key}`, error);
      return -1;
    }
  }

  async safeKeys(pattern: string): Promise<string[]> {
    if (!this.client.isReady) {
      this.logger.warn(`Redis not ready, skipping keys for pattern: ${pattern}`);
      return [];
    }

    try {
      return await this.keys(pattern);
    } catch (error) {
      this.logger.warn(`Redis keys failed for pattern: ${pattern}`, error);
      return [];
    }
  }

  async safeExpire(key: string, seconds: number): Promise<void> {
    if (!this.client.isReady) {
      this.logger.warn(`Redis not ready, skipping expire for key: ${key}`);
      return;
    }

    try {
      await this.expire(key, seconds);
    } catch (error) {
      this.logger.warn(`Redis expire failed for key: ${key}`, error);
    }
  }

  async safePublish(channel: string, message: string): Promise<number> {
    if (!this.client.isReady) {
      this.logger.warn(`Redis not ready, skipping publish for channel: ${channel}`);
      return 0;
    }

    try {
      return await this.publish(channel, message);
    } catch (error) {
      this.logger.warn(`Redis publish failed for channel: ${channel}`, error);
      return 0;
    }
  }

  // ===== 분산 락 =====

  async acquireLock(key: string, ttlSeconds: number): Promise<string | null> {
    const token = randomUUID();
    const result = await this.client.set(key, token, { NX: true, EX: ttlSeconds });
    return result === 'OK' ? token : null;
  }

  async acquireRequiredLock(key: string, ttlSeconds: number): Promise<string | null> {
    if (!this.client.isReady) {
      throw new Error(`Redis not ready for acquireLock: ${key}`);
    }
    return this.acquireLock(key, ttlSeconds);
  }

  /**
   * 원자적 compare-and-set: 저장값이 expected와 같을 때만 next로 교체하고 TTL을 건다(단일 Lua).
   * GET→비교→SET을 별도 명령으로 하면 동시 요청에서 TOCTOU race가 나므로 CAS로 묶는다.
   * @returns 교체 성공(일치) 시 true, 불일치/키부재 시 false.
   */
  async compareAndSet(key: string, expected: string, next: string, ttlSeconds: number): Promise<boolean> {
    const script =
      "if redis.call('get', KEYS[1]) == ARGV[1] then redis.call('set', KEYS[1], ARGV[2], 'EX', ARGV[3]); return 1 else return 0 end";
    const result = await this.client.eval(script, { keys: [key], arguments: [expected, next, String(ttlSeconds)] });
    return result === 1;
  }

  async releaseLock(key: string, token: string): Promise<boolean> {
    const script = "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end";
    const result = await this.client.eval(script, { keys: [key], arguments: [token] });
    return result === 1;
  }

  async safeAcquireLock(key: string, ttlSeconds: number): Promise<string | null> {
    if (!this.client.isReady) {
      this.logger.warn(`Redis not ready, skipping acquireLock for key: ${key}`);
      return null;
    }
    try {
      return await this.acquireLock(key, ttlSeconds);
    } catch (error) {
      this.logger.warn(`Redis acquireLock failed for key: ${key}`, error);
      return null;
    }
  }

  async safeReleaseLock(key: string, token: string): Promise<void> {
    if (!this.client.isReady) return;
    try {
      await this.releaseLock(key, token);
    } catch (error) {
      this.logger.warn(`Redis releaseLock failed for key: ${key}`, error);
    }
  }

  safePipeline(): SafeRedisPipeline {
    const multi = this.client.multi();
    return new SafeRedisPipelineAdapter(multi, this.logger, this.client);
  }

  /**
   * Redis 재연결 완료 시 실행될 콜백 등록
   */
  onReconnected(callback: () => void | Promise<void>): void {
    this.reconnectedCallbacks.push(callback);
    this.logger.debug('Reconnected callback registered');
  }

  /**
   * 재연결 콜백 실행
   */
  private async executeReconnectedCallbacks(): Promise<void> {
    for (const callback of this.reconnectedCallbacks) {
      try {
        await callback();
      } catch (error) {
        this.logger.error('Error executing reconnected callback', error);
      }
    }
  }
}

/**
 * Redis Pipeline Adapter
 *
 * node-redis multi를 RedisPipeline 인터페이스로 래핑
 */
class RedisPipelineAdapter implements RedisPipeline {
  constructor(private readonly pipeline: ReturnType<RedisClientType['multi']>) {}

  set(key: string, value: string): RedisPipeline {
    this.pipeline.set(key, value);
    return this;
  }

  get(key: string): RedisPipeline {
    this.pipeline.get(key);
    return this;
  }

  del(...keys: string[]): RedisPipeline {
    this.pipeline.del(keys);
    return this;
  }

  expire(key: string, seconds: number): RedisPipeline {
    this.pipeline.expire(key, seconds);
    return this;
  }

  async exec(): Promise<Array<[Error | null, any]>> {
    try {
      const results = await this.pipeline.execAsPipeline();
      return results.map((result: unknown) => [null, result]);
    } catch (error) {
      return [[error as Error, null]];
    }
  }
}

/**
 * Safe Redis Pipeline Adapter
 *
 * Redis 장애 시에도 안전하게 동작하는 Pipeline
 * - 실패 시 경고 로깅만 수행
 */
class SafeRedisPipelineAdapter implements SafeRedisPipeline {
  constructor(
    private readonly pipeline: ReturnType<RedisClientType['multi']>,
    private readonly logger: FrameworkLogger,
    private readonly client: RedisClientType,
  ) {}

  set(key: string, value: string): SafeRedisPipeline {
    this.pipeline.set(key, value);
    return this;
  }

  get(key: string): SafeRedisPipeline {
    this.pipeline.get(key);
    return this;
  }

  del(...keys: string[]): SafeRedisPipeline {
    this.pipeline.del(keys);
    return this;
  }

  expire(key: string, seconds: number): SafeRedisPipeline {
    this.pipeline.expire(key, seconds);
    return this;
  }

  async exec(): Promise<void> {
    if (!this.client.isReady) {
      this.logger.warn('Redis not ready, skipping pipeline execution');
      return;
    }

    try {
      await this.pipeline.execAsPipeline();
    } catch (error) {
      this.logger.warn('Redis pipeline execution failed', error);
    }
  }
}
