import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule, JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

import { getEnvFilePath } from '@/common/config/runtime-env';

import { configLoaders } from './config/configs';
import { validateEnv } from './config/env.schema';
import { AuthGuard } from './core/auth/auth.guard';
import { FrameworkGlobalInterceptor } from './core/interceptors/framework-global.interceptor';
import { OtelShutdownService } from './core/tracing/otel-shutdown.service';
import { HealthController } from './health.controller';
import { ACCESS_POLICY_PROVIDER, DenyAllAccessPolicyProvider, PolicyGuard } from './lib/access-control';
import { DatabaseModule } from './lib/database/database.module';
import { MailModule } from './lib/mail/mail.module';
import { RedisModule } from './lib/redis/redis.module';
import { StorageModule } from './lib/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
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
    ThrottlerModule.forRoot(),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    CacheModule.register({ isGlobal: true, ttl: 600 }),

    // Infrastructure
    DatabaseModule,
    RedisModule,
    MailModule,
    StorageModule,

    // Business modules
    IdentityModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    // 접근제어 매트릭스 기본값: 전부 거부(default-deny). 도메인 단계에서 ACCESS_POLICY_PROVIDER를
    // 실제 역할×액션 매트릭스(StaticAccessPolicyProvider 등)로 교체한다.
    { provide: ACCESS_POLICY_PROVIDER, useClass: DenyAllAccessPolicyProvider },
    { provide: APP_GUARD, useClass: AuthGuard }, // Tier0 인증
    { provide: APP_GUARD, useClass: PolicyGuard }, // Tier1 인가 (RBAC)
    { provide: APP_INTERCEPTOR, useClass: FrameworkGlobalInterceptor },
    OtelShutdownService,
  ],
})
export class AppModule {}
