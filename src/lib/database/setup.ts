import { withOrm } from './seed/seed.util';

/**
 * Core 시드 러너 — 전 환경 공통 기준 데이터(역할 등).
 * 실행: `pnpm seed`
 *
 * 엔티티가 추가되면 여기서 core 시더를 호출한다:
 *   await orm.seeder.seed(RoleSeeder);
 */
void withOrm('CoreSeed', async (_orm, logger) => {
  logger.warn('등록된 core 시더가 없습니다. 엔티티 추가 후 setup.ts에 시더를 연결하세요.');
});
