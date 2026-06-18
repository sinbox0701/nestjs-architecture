import { MikroORM } from '@mikro-orm/postgresql';

import { FrameworkLogger } from '@/core/logger/framework-logger';

import config from './mikro-orm.config';

/**
 * Standalone 마이그레이션 러너.
 *
 * stage/prod에서 앱 부팅 전에 실행한다(예: 배포 파이프라인/엔트리포인트):
 *   node dist/lib/database/run-migrations.js
 *   pnpm ts-node src/lib/database/run-migrations.ts   # 로컬
 *
 * dev는 DatabaseModule이 schema.update()로 자동 동기화하므로 보통 불필요하다.
 */
async function runMigrations(): Promise<void> {
  const logger = new FrameworkLogger('RunMigrations');
  const orm = await MikroORM.init(config);

  try {
    const pending = await orm.migrator.getPending();
    if (pending.length === 0) {
      logger.log('No pending migrations.');
      return;
    }

    logger.log(`Running ${pending.length} pending migration(s)...`);
    await orm.migrator.up();
    logger.log('Migrations applied successfully.');
  } finally {
    await orm.close(true);
  }
}

runMigrations().catch((err) => {
  console.error('[run-migrations] failed:', err);
  process.exitCode = 1;
});
