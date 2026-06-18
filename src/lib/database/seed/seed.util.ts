import { MikroORM } from '@mikro-orm/postgresql';

import { FrameworkLogger } from '@/core/logger/framework-logger';

import config from '../mikro-orm.config';

/**
 * standalone 시더 러너 헬퍼.
 * ORM을 init → 콜백 실행 → close 한다. setup.ts / setup-mock.ts에서 사용.
 */
export async function withOrm(
  label: string,
  fn: (orm: MikroORM, logger: FrameworkLogger) => Promise<void>,
): Promise<void> {
  const logger = new FrameworkLogger(label);
  const orm = await MikroORM.init(config);
  try {
    await fn(orm, logger);
    logger.log(`${label} completed`);
  } finally {
    await orm.close(true);
  }
}
