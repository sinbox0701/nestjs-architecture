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
import { RolesGuard } from './lib/access-control';
import { DatabaseModule } from './lib/database/database.module';
import { MailModule } from './lib/mail/mail.module';
import { RedisModule } from './lib/redis/redis.module';
import { StorageModule } from './lib/storage/storage.module';

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
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('auth.jwtSecret'),
        signOptions: {
          expiresIn: config.getOrThrow<string>('auth.jwtExpiresIn') as JwtSignOptions['expiresIn'],
        },
      }),
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

    // Business modules는 도메인 단계에서 여기에 추가한다 (src/modules/*).
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: FrameworkGlobalInterceptor },
    OtelShutdownService,
  ],
})
export class AppModule {}
