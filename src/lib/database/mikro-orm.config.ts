import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig, LoadStrategy, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { SeedManager } from '@mikro-orm/seeder';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';

import { loadRuntimeEnv } from '@/common/config/runtime-env';
import { OrmLogger } from '@/core/logger/orm-logger';
import { CustomNamingStrategy } from '@/lib/database/custom-naming.strategy';

loadRuntimeEnv();

// CLI/Jest는 ts 엔티티, 런타임(dist)은 js 엔티티를 로드한다.
const entitySource =
  process.env.MIKRO_ORM_ENTITY_SOURCE ?? (process.env.JEST_WORKER_ID ? 'ts' : __filename.endsWith('.ts') ? 'ts' : 'js');
const useTsEntities = entitySource === 'ts';

export default defineConfig({
  metadataProvider: ReflectMetadataProvider,
  entities: ['./dist/**/entity/*.entity.js'],
  entitiesTs: ['./src/**/entity/*.entity.ts'],
  preferTs: useTsEntities,
  // 스타터에는 아직 엔티티가 없다. 첫 엔티티 추가 전까지 "No entities discovered" 에러를 끈다.
  discovery: { warnWhenNoEntities: false },
  allowGlobalContext: process.env.MIKRO_ORM_ALLOW_GLOBAL_CONTEXT === 'true',
  dbName: process.env.POSTGRES_DB,
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  port: Number(process.env.POSTGRES_PORT),
  driver: PostgreSqlDriver,
  forceUtcTimezone: true,
  debug: process.env.ORM_DEBUG === 'true',
  colors: process.env.ORM_DEBUG === 'true',
  highlighter: new SqlHighlighter(),
  namingStrategy: CustomNamingStrategy,
  loggerFactory: (options) => new OrmLogger(options),
  // populate depth ≤2 → JOINED 기본. ≥3은 SELECT_IN을 쿼리별로 지정. 참조: docs/convention/10-query-strategy.md
  loadStrategy: LoadStrategy.JOINED,
  schemaGenerator: {
    // FK 제약을 DB 레벨로 생성해 참조 무결성을 DB가 보장한다.
    // 테스트 teardown은 `TRUNCATE ... CASCADE`(truncateAll)가 FK 의존 행까지 정리하므로
    // FK가 켜져 있어도 순서 의존 문제가 없다. 참조: docs/convention/08-testing.md
    createForeignKeyConstraints: true,
  },
  pool: {
    min: Number(process.env.MIKRO_ORM_CONNECTION_POOL_MIN ?? 2),
    max: Number(process.env.MIKRO_ORM_CONNECTION_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.MIKRO_ORM_POOL_IDLE_TIMEOUT ?? 30_000),
  },
  migrations: {
    tableName: 'backend_template_migrations',
    path: './dist/migrations',
    pathTs: './migrations',
    // Postgres에서 disableForeignKeys=true는 `SET session_replication_role`(superuser 필요)을
    // 쓴다. stage/prod 마이그레이션 롤이 superuser가 아닐 수 있으므로 false로 둔다.
    // MikroORM이 DDL을 의존 순서대로 정렬해 발행하므로 FK가 켜져 있어도 안전하다.
    disableForeignKeys: false,
    // 초기 CREATE 마이그레이션을 생성하면 dev/prod 단일 소스가 유지된다.
    // 참조: docs/convention/09-deployment.md (Baseline 전진 절차)
  },
  filters: {
    softDelete: {
      cond: { deletedAt: null },
      default: true,
    },
  },
  seeder: {
    path: './dist/lib/database/seed',
    pathTs: './src/lib/database/seed',
  },
  extensions: [Migrator, SeedManager],
});
