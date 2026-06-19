import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule, JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { getEnvFilePath } from '@/common/config/runtime-env';

import { configLoaders } from './config/configs';
import { validateEnv } from './config/env.schema';
import { AuthGuard } from './core/auth/auth.guard';
import { FrameworkGlobalInterceptor } from './core/interceptors/framework-global.interceptor';
import { OtelShutdownService } from './core/tracing/otel-shutdown.service';
import { HealthController } from './health.controller';
import { PolicyGuard } from './lib/access-control';
import { DatabaseModule } from './lib/database/database.module';
import { KyselyModule } from './lib/database/kysely/kysely.module';
import { MailModule } from './lib/mail/mail.module';
import { RedisModule } from './lib/redis/redis.module';
import { StorageModule } from './lib/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { identityAccessPolicyProvider } from './modules/identity/access/identity-access.provider';
import { IdentityModule } from './modules/identity/identity.module';

@Module({
  imports: [
    // Framework
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      envFilePath: getEnvFilePath(),
      load: configLoaders,
      validate: validateEnv,
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const algorithm = config.getOrThrow<string>('auth.jwtAlgorithm') as JwtSignOptions['algorithm'];
        return {
          secret: config.getOrThrow<string>('auth.jwtSecret'),
          signOptions: {
            algorithm,
            expiresIn: config.getOrThrow<string>('auth.jwtExpiresIn') as JwtSignOptions['expiresIn'],
          },
          // 알고리즘 allowlist 고정: alg 치환/`none` 수용을 차단(인증 경계 defense-in-depth).
          // 값은 JWT_ALGORITHM(env, HMAC 계열)에서 온다.
          verifyOptions: {
            algorithms: [algorithm].filter((a): a is NonNullable<typeof a> => a != null),
          },
        };
      },
    }),
    // 전역 기본 레이트리밋(60초/100req). 인증 라우트는 컨트롤러에서 @Throttle로 더 조인다.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    CacheModule.register({ isGlobal: true, ttl: 600 }),

    // Infrastructure
    DatabaseModule,
    KyselyModule, // 복잡 조회(집계/대시보드)용 읽기 전용 Kysely 경로. 참조: docs/convention/10-query-strategy.md
    RedisModule,
    MailModule,
    StorageModule,

    // Business modules
    IdentityModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    // 접근제어 Tier1 매트릭스: identity 도메인이 역할(Role; Red/Blue) 이름 기반 capability 매트릭스를
    // 바인딩한다(스타터 기본 DenyAll 교체). 합성 루트가 도메인 정책을 주입하는 지점.
    identityAccessPolicyProvider,
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // 레이트리밋(인증 전에 동작)
    { provide: APP_GUARD, useClass: AuthGuard }, // Tier0 인증
    { provide: APP_GUARD, useClass: PolicyGuard }, // Tier1 인가 (RBAC)
    { provide: APP_INTERCEPTOR, useClass: FrameworkGlobalInterceptor },
    OtelShutdownService,
  ],
})
export class AppModule {}
