import { MikroORM, Options } from '@mikro-orm/postgresql';

import ormConfig from '@/lib/database/mikro-orm.config';

/**
 * 테스트용 MikroORM 설정을 반환한다.
 *
 * 앱의 기본 mikro-orm.config(default export)를 그대로 사용한다. 해당 설정은
 * 이미 `createForeignKeyConstraints: false` 를 갖고 있어 테스트 truncate 를
 * 단순화한다. Jest 환경(JEST_WORKER_ID)에서는 ts 엔티티를 로드한다.
 */
export function buildTestOrmConfig(): Options {
  return ormConfig;
}

/** 테스트용 MikroORM 인스턴스를 초기화한다. */
export function initTestOrm(): Promise<MikroORM> {
  return MikroORM.init(buildTestOrmConfig());
}
