import { isProdAppEnv } from '@/common/config/runtime-env';

import { withOrm } from './seed/seed.util';

/**
 * Mock 데이터 시드 러너 — 데브 서버 채우기용.
 * 실행: `pnpm mock:seed`
 *
 * `@faker-js/faker`로 대량의 가짜 데이터를 만든다. prod에서는 절대 실행하지 않는다.
 * 엔티티가 추가되면 아래 패턴으로 채운다:
 *
 *   import { faker } from '@faker-js/faker';
 *   for (let i = 0; i < 50; i++) {
 *     orm.em.persist(em.create(User, { email: faker.internet.email(), ... }));
 *   }
 *   await orm.em.flush();
 */
void withOrm('MockSeed', async (_orm, logger) => {
  if (isProdAppEnv()) {
    logger.error('mock:seed는 prod에서 실행할 수 없습니다. 중단합니다.');
    process.exitCode = 1;
    return;
  }

  logger.warn('등록된 mock 시더가 없습니다. 엔티티 추가 후 setup-mock.ts에 faker 시드를 연결하세요.');
});
