import { MikroORM, Options } from '@mikro-orm/postgresql';

import ormConfig from '@/lib/database/mikro-orm.config';

/**
 * 테스트용 MikroORM 설정을 반환한다.
 *
 * 앱의 기본 mikro-orm.config(default export)를 그대로 사용한다. 해당 설정은
 * `createForeignKeyConstraints: true` 라서 FK 제약이 살아있고, 테스트 truncate 는
 * `TRUNCATE ... CASCADE` 로 정리한다(09-testing 참조). Jest 환경(JEST_WORKER_ID)에서는
 * ts 엔티티를 로드한다.
 */
export function buildTestOrmConfig(): Options {
  return ormConfig;
}

/** 테스트용 MikroORM 인스턴스를 초기화한다. */
export function initTestOrm(): Promise<MikroORM> {
  return MikroORM.init(buildTestOrmConfig());
}
