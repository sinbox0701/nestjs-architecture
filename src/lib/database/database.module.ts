import { Module, OnModuleInit } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MikroORM } from '@mikro-orm/postgresql';

import { isDevAppEnv } from '@/common/config/runtime-env';
import { FrameworkLogger } from '@/core/logger/framework-logger';

import config from './mikro-orm.config';

/**
 * DatabaseModule
 *
 * - dev: 엔티티 기반 스키마 자동 동기화(빠른 반복).
 * - stage/prod: pending 마이그레이션이 0인지만 확인. 실제 실행은
 *   `pnpm migration:up`(또는 run-migrations.ts)이 앱 시작 전에 담당한다.
 *
 * 시딩은 모듈 부트가 아니라 명시적 스크립트로 분리한다:
 *   - `pnpm seed`       core seed (role 등)
 *   - `pnpm mock:seed`  dev 서버용 mock 데이터 (faker)
 */
@Module({
  imports: [MikroOrmModule.forRoot(config)],
})
export class DatabaseModule implements OnModuleInit {
  private readonly logger = new FrameworkLogger(DatabaseModule.name);

  constructor(private readonly orm: MikroORM) {}

  async onModuleInit(): Promise<void> {
    if (!isDevAppEnv()) {
      const pending = await this.orm.migrator.getPending();
      if (pending.length > 0) {
        throw new Error(
          `${pending.length} pending migration(s) detected. Run migrations before starting the app:\n` +
            `  pnpm migration:up`,
        );
      }
      return;
    }

    // dev: 엔티티 ↔ 스키마 자동 동기화
    const diff = await this.orm.schema.getUpdateSchemaSQL({ wrap: false });
    if (diff.trim()) {
      this.logger.log('Schema diff detected — synchronizing with entities...');
      await this.orm.schema.update();
      this.logger.log('Schema synchronized');
    }
  }
}
