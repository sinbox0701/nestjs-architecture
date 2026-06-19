import { Global, Module } from '@nestjs/common';
import { AbstractSqlConnection, Kysely, MikroORM } from '@mikro-orm/postgresql';

/**
 * Kysely 읽기 전용 인스턴스 주입 토큰.
 *
 * lib는 도메인 테이블을 알 수 없으므로(no-lib-to-modules) `Kysely<any>`로 둔다.
 * 각 도메인 ReadModel이 자기 테이블 인터페이스로 **재타이핑**해서 쓴다.
 * 참조: docs/convention/10-query-strategy.md, src/modules/identity/read-model/
 */
export const KYSELY_DB = Symbol('KYSELY_DB');

/** 도메인 ReadModel이 주입받는 Kysely 타입. 사용처에서 `as Kysely<XxxDatabase>`로 좁힌다. */
export type AppKysely = Kysely<any>;

/**
 * KyselyModule — 복잡 조회(집계·대시보드·리포트)용 Kysely 경로.
 *
 * **MikroORM v7은 내부적으로 Kysely 위에 구축**되어 있다(v6의 knex 제거). 따라서 별도 풀을
 * 만들지 않고 `connection.getClient()`로 **MikroORM이 쓰는 바로 그 Kysely 인스턴스(=커넥션 풀)**를
 * 그대로 재사용한다. 이중 풀로 인한 커넥션 고갈이 없고, 풀 생명주기는 MikroORM이 관리한다
 * (별도 onModuleDestroy 불필요).
 *
 * 반환되는 클라이언트는 풀 레벨(루트)이라 쓰기 UoW 트랜잭션에 묶이지 않는다 → **읽기 전용**으로만
 * 쓴다. 쓰기는 MikroORM Unit of Work.
 */
@Global()
@Module({
  providers: [
    {
      provide: KYSELY_DB,
      inject: [MikroORM],
      useFactory: (orm: MikroORM): AppKysely =>
        // em.getConnection()의 정적 타입은 base Connection이라 getClient가 없다 → SQL 커넥션으로 좁힌다.
        (orm.em.getConnection() as AbstractSqlConnection).getClient(),
    },
  ],
  exports: [KYSELY_DB],
})
export class KyselyModule {}
