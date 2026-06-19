# 쿼리 전략

backend-template는 조회/쓰기 성격에 따라 **3경로 규칙**으로 데이터 접근을 분리한다. MikroORM(Unit of Work)을 기본으로 하되, 복잡 조회는 Kysely 기반 ReadModel로 우회할 수 있다.

## 3경로 규칙

| 경로                                | 도구                        | 적용 대상                                                                          |
| ----------------------------------- | --------------------------- | ---------------------------------------------------------------------------------- |
| 도메인 내부 CRUD / 쓰기 / 단건 조회 | **MikroORM** (Repo+Service) | 생성·수정·삭제, FK 관계 로딩, 단건/소규모 목록 조회                                |
| 복잡 조회 · 대시보드 · 집계         | **Kysely ReadModel**        | 다중 JOIN, GROUP BY, 통계, 페이지네이션 집계. **읽기 전용**, 도메인 경계 무시 가능 |
| 도메인 간 읽기                      | **ReadService**             | 다른 도메인의 데이터가 필요할 때. Repo를 직접 공유하지 않는다                      |

### 경로별 원칙

- **MikroORM (도메인 내부)**: 자기 모듈의 엔티티에 대한 CRUD와 단건/관계 조회는 항상 MikroORM Repository를 통한다. write는 반드시 ORM(Unit of Work)을 거친다. raw SQL로 write하지 않는다.
- **Kysely ReadModel (복잡 조회)**: ORM QueryBuilder로 표현하기 어렵거나 N+1/성능 문제가 있는 집계·대시보드·리포트성 조회는 Kysely로 작성한다. ReadModel은 **읽기 전용**이며, 효율을 위해 도메인 경계를 가로지르는 JOIN을 허용한다. 결과 타입은 명시적으로 선언한다(`any` 금지).
- **ReadService (도메인 간 읽기)**: A 도메인이 B 도메인의 데이터를 읽어야 하면 B의 `*ReadService`를 주입해 호출한다. **B의 Repository를 A에 직접 주입하지 않는다**(모듈 경계 보호). 같은 `*.module.ts`의 `forFeature`에 함께 등록된 엔티티는 예외(`04-layer-responsibility.md` 참조).

## Kysely 통합 (배선 완료 + 레퍼런스 구현)

Kysely 경로는 **배선이 끝나 있다**. `KyselyModule`(`src/lib/database/kysely/kysely.module.ts`)이 `KYSELY_DB` 토큰으로 읽기 전용 Kysely 인스턴스를 전역 제공하고, 레퍼런스 구현은 `src/modules/identity/read-model/`(팀 로스터 집계)다.

### 커넥션: MikroORM의 Kysely 클라이언트를 재사용

- **MikroORM v7은 내부가 Kysely로 구축**되어 있다(v6의 knex 제거 — `getKnex()`는 없어졌고 `AbstractSqlConnection.getClient<T>(): Kysely<T>`가 그 자리). 따라서 별도 풀/별도 `pg` 의존성 없이 **MikroORM이 쓰는 바로 그 Kysely 인스턴스를 그대로 재사용**한다:

  ```typescript
  // KyselyModule provider (요약)
  useFactory: (orm: MikroORM) => (orm.em.getConnection() as AbstractSqlConnection).getClient();
  ```

- 이중 풀이 없으므로 커넥션 고갈/풀 분리 문제가 없고, 풀 생명주기는 MikroORM이 관리한다(별도 정리 불필요).
- `Kysely`/`PostgresDialect` 등은 **`@mikro-orm/postgresql`에서 import**한다(별도 `kysely` 설치 금지 — MikroORM이 번들한 동일 버전을 써야 인스턴스/타입 불일치가 없다).
- `getClient()`는 풀 레벨(루트) 클라이언트라 쓰기 UoW 트랜잭션에 묶이지 않는다 → **읽기 전용 조회에만** 쓴다.

### ReadModel 작성 규칙

- **읽기 전용.** 쓰기는 절대 Kysely로 하지 않는다(MikroORM Unit of Work만 사용).
- lib는 도메인 테이블을 모른다(`no-lib-to-modules`) → 주입 타입은 `AppKysely`(`Kysely<any>`), 각 ReadModel이 자기 테이블 인터페이스(`*.database.ts`)로 `as Kysely<XxxDatabase>` 좁혀 쓴다.
- 스키마 타입은 **엔티티와 별도의 진실원천**이다(Kysely가 자체 타입을 요구). 엔티티를 바꾸면 함께 갱신한다. 테이블이 많아지면 `kysely-codegen` 자동 생성을 검토한다.
- **전역 softDelete 필터는 Kysely에 적용되지 않는다** → `deleted_at IS NULL`을 쿼리에서 직접 명시한다.
- pg는 `count()`/집계를 문자열로 반환 → 결과를 `Number()`로 좁히고 결과 타입을 명시한다(`any` 금지).

레퍼런스: `team-roster.read-model.ts`(3 테이블 JOIN + GROUP BY + `count() FILTER` 조건부 카운트), `team.controller.ts`의 `GET /teams/roster`, 통합 테스트 `tests/integration/identity/team-roster.read-model.integration.spec.ts`.

### 심화 예시: raw SQL 대시보드 쿼리 → Kysely ReadModel

집계 대시보드는 보통 raw SQL로 짜기 쉬운데(`em.getConnection().execute('SELECT …')`), 그러면 **결과 타입을 손으로 선언**(`execute<any[]>`)하게 되어 컬럼 오타·스키마 변경이 런타임에야 터진다. 같은 쿼리를 Kysely ReadModel로 옮기면 컬럼/조인/결과가 컴파일 타임에 잡힌다.

아래는 raw SQL 대시보드 쿼리(CTE 3개 + 조건부 distinct 카운트 + 난이도 구간별 풀이율)를 Kysely로 옮긴 예다. _참고용 — 여기 쓰인 테이블은 backend-template엔 없다._

**Before (raw SQL, 결과 타입 수동):**

```typescript
const rows = await this.em.getConnection().execute<any[]>(
  `WITH org_challenges AS ( SELECT DISTINCT wc.id AS challenge_id, p.level FROM license_seats ls
      JOIN ... WHERE l.group_id = ? AND ls.profile_id = ? AND lc.product_type = 'WARGAME' AND ... ),
    user_solved AS ( SELECT DISTINCT ws.challenge_id FROM wargame_submissions ws ... ),
    difficulty_group AS ( SELECT challenge_id, level, CASE WHEN level BETWEEN 1 AND 3 THEN '1~3' ... END AS label, ... )
   SELECT dg.label,
     COUNT(DISTINCT dg.challenge_id) AS total,
     COUNT(DISTINCT CASE WHEN us.challenge_id IS NOT NULL THEN dg.challenge_id END) AS solved
   FROM difficulty_group dg LEFT JOIN user_solved us ON us.challenge_id = dg.challenge_id
   GROUP BY dg.label, dg.sort_order ORDER BY dg.sort_order`,
  [groupId, profileId, profileId], // ← 위치 기반 ? 파라미터(순서 틀리면 런타임 버그)
);
```

**After (Kysely ReadModel, 타입 안전):**

```typescript
import { Kysely, sql } from '@mikro-orm/postgresql';

const rows = await this.db
  .with('org_challenges', (qb) =>
    qb
      .selectFrom('license_seats as ls')
      .innerJoin('licenses as l', 'l.id', 'ls.license_id')
      .innerJoin('license_coverages as lc', 'lc.license_id', 'ls.license_id')
      .innerJoin('wargame_challenges as wc', 'wc.id', 'lc.product_id')
      .innerJoin('problems as p', 'p.id', 'wc.problem_id')
      .where('l.group_id', '=', groupId) // ← 이름 기반 바인딩(? 순서 실수 없음)
      .where('ls.profile_id', '=', profileId)
      .where('lc.product_type', '=', 'WARGAME')
      .where('l.deleted_at', 'is', null)
      .where('lc.deleted_at', 'is', null)
      .where((eb) =>
        eb.or([
          eb.and([eb('lc.auto_enroll', '=', true), eb('ls.coverage_id', 'is', null)]),
          eb('ls.coverage_id', '=', eb.ref('lc.id')),
        ]),
      )
      .distinct()
      .select(['wc.id as challenge_id', 'p.level']),
  )
  .with('user_solved', (qb) =>
    qb
      .selectFrom('wargame_submissions as ws')
      .innerJoin('org_challenges as oc', 'oc.challenge_id', 'ws.challenge_id')
      .where('ws.profile_id', '=', profileId)
      .where('ws.correct', '=', true)
      .where('ws.deleted_at', 'is', null)
      .distinct()
      .select('ws.challenge_id'),
  )
  .with('difficulty_group', (qb) =>
    qb.selectFrom('org_challenges').select((eb) => [
      'challenge_id',
      // 다분기 CASE 버킷처럼 빌더로 장황한 부분은 sql 템플릿으로 — 그래도 결과 별칭 타입은 명시한다.
      sql<string>`case when level between 1 and 3 then '1~3' when level between 4 and 6 then '4~6'
        when level between 7 and 8 then '7~8' when level between 9 and 10 then '9~10' end`.as('label'),
      sql<number>`case when level between 1 and 3 then 1 when level between 4 and 6 then 2
        when level between 7 and 8 then 3 when level between 9 and 10 then 4 end`.as('sort_order'),
    ]),
  )
  .selectFrom('difficulty_group as dg')
  .leftJoin('user_solved as us', 'us.challenge_id', 'dg.challenge_id')
  .groupBy(['dg.label', 'dg.sort_order'])
  .orderBy('dg.sort_order')
  .select((eb) => [
    'dg.label',
    eb.fn.count('dg.challenge_id').distinct().as('total'),
    // COUNT(DISTINCT CASE WHEN matched …) ≡ count(distinct …) FILTER (WHERE matched)
    eb.fn.count('dg.challenge_id').distinct().filterWhere('us.challenge_id', 'is not', null).as('solved'),
  ])
  .execute();

// 비율 같은 파생 스칼라는 SQL에 욱여넣지 말고 JS에서 — 더 명확하고 타입도 number로 확정.
const difficulties = rows.map((r) => {
  const total = Number(r.total); // pg는 count를 문자열로 반환 → Number()
  const solved = Number(r.solved);
  return { label: r.label, total, solved, rate: total === 0 ? 0 : Math.floor((solved / total) * 100) };
});
```

기법 매핑:

| raw SQL                                       | Kysely                                                |
| --------------------------------------------- | ----------------------------------------------------- |
| `WITH x AS (...)`                             | `.with('x', (qb) => …)`                               |
| `? ` 위치 파라미터                            | `.where('col', '=', value)` 이름 바인딩               |
| `(A AND B) OR C`                              | `eb.or([eb.and([…]), …])`                             |
| `COUNT(DISTINCT col)`                         | `eb.fn.count('col').distinct()`                       |
| `COUNT(DISTINCT CASE WHEN cond THEN col END)` | `eb.fn.count('col').distinct().filterWhere(cond)`     |
| 다분기 `CASE`/윈도우 함수 등 난해한 SQL       | ``sql<T>`…`.as('alias')`` (탈출구 — 결과 타입은 명시) |
| `floor(a/b*100)` 파생 비율                    | JS에서 계산(`Math.floor`) — 단순 파생은 SQL에 안 넣음 |

> 핵심: **camp가 `personal-dashboard.repository.ts`에서 raw SQL로 하던 교차 집계를, backend-template은 Kysely ReadModel로 대체**한다. 같은 커넥션·같은 표현력에 컴파일 타임 타입 안전이 더해진다. Kysely로 도저히 안 되는 극단적 SQL만 `em.getConnection().execute()` raw 경로로 남긴다.

## Load Strategy 매트릭스

`populate` 깊이에 따라 로딩 전략을 선택한다. 전역 기본값은 `LoadStrategy.JOINED`(`src/lib/database/mikro-orm.config.ts`).

| 상황                     | 전략                  | 비고                                                         |
| ------------------------ | --------------------- | ------------------------------------------------------------ |
| populate 깊이 ≤ 2        | `JOINED` (기본)       | 단일 JOIN 쿼리. 전역 기본값                                  |
| populate 깊이 ≥ 3        | `SELECT_IN`           | 깊은 그래프는 쿼리별로 `SELECT_IN` 지정 (카테시안 폭발 방지) |
| cross-domain 리스트 조합 | **Assembler (batch)** | 목록을 ID로 모아 도메인별 배치 조회 후 메모리에서 조립       |

- 깊이 ≥ 3은 repository 메서드에서 해당 populate에 `{ strategy: LoadStrategy.SELECT_IN }`을 지정한다.
- cross-domain 리스트는 ORM populate로 끌어오지 말고, service에서 ID 배치 조회(`IN`) 후 DTO로 조립한다(N+1 방지).

## 인덱스 원칙

**EXPLAIN ANALYZE 없이 인덱스를 거는 건 도박이다.** 실제 쿼리 플랜을 확인하고 인덱스를 추가한다. 다음 기준에 해당하면 인덱스 후보다.

- `WHERE` 절에 빈번히 등장하는 컬럼
- 복합 조건(여러 컬럼 AND) — 복합 인덱스 검토
- `ORDER BY` + `LIMIT` 조합 (정렬+페이지네이션)
- soft delete 필터 — `deleted_at IS NULL` partial index

```sql
-- partial index 예시 (soft delete 대상)
CREATE INDEX IF NOT EXISTS idx_notes_owner_active
  ON "notes" ("owner_id")
  WHERE "deleted_at" IS NULL;
```

인덱스는 마이그레이션에서 idempotent SQL(`IF NOT EXISTS`)로 추가한다(`09-deployment.md` 참조).

### FK 컬럼은 기본 인덱스 대상 (EXPLAIN 예외)

**Postgres는 PK에는 인덱스를 자동 생성하지만 FK 컬럼에는 만들지 않는다.** 이 프로젝트는 FK 제약을 켜 두므로(`createForeignKeyConstraints: true`), 인덱스 없는 `@ManyToOne` 컬럼은:

- 자식→부모 JOIN이 seq scan
- **부모 행 삭제/수정 시 FK 검증을 위해 자식 테이블 풀스캔 + 락**

→ 따라서 **모든 `@ManyToOne` FK 컬럼은 EXPLAIN 없이도 기본으로 인덱스를 건다.** MikroORM 데코레이터에서 직접 선언한다.

```typescript
@ManyToOne(() => Owner, { ref: true, index: true }) // index: true → FK 컬럼 인덱스 DDL 생성
owner!: Ref<Owner>;
```

복합 조회 패턴이 명확하면 `(owner_id, status)` 복합 인덱스를 별도로 검토한다(이건 EXPLAIN 기반).

### soft delete 엔티티의 unique 제약은 partial로

전역 soft delete 필터는 삭제된 행을 테이블에 남긴다. 평범한 `@Unique()`를 걸면 **삭제된 행이 값을 점유**해, 같은 값으로의 재생성(예: 탈퇴 후 같은 email 재가입)이 막힌다.

→ soft delete 대상 엔티티의 유니크 조건은 **partial unique index**로 만든다(살아있는 행에만 적용).

```sql
-- 활성 행에 대해서만 유니크
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_active
  ON "users" ("email")
  WHERE "deleted_at" IS NULL;
```

MikroORM `@Unique()`는 partial 조건을 직접 표현하지 못하므로, 마이그레이션에서 위 SQL로 명시한다.

## PK 전략

기본은 `BaseEntity`의 `integer autoincrement`다(`src/common/base/base.entity.ts`). 도메인 특성에 따라 아래를 검토한다.

| 상황                                        | 선택             | 비고                                                                                         |
| ------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| 일반 CRUD 엔티티                            | `integer` (기본) | 가장 단순/효율                                                                               |
| 대량 누적(이벤트 로그·점수·메시지 등)       | `bigint`         | `integer`는 약 21.4억 행 상한. **MikroORM에서 bigint PK는 JS `string`으로 매핑**되는 점 주의 |
| 외부로 ID가 노출되고 열거(enumeration) 위험 | `uuid` (v7 권장) | IDOR 표면 축소. 단 인덱스 크기↑·정렬 지역성↓. Tier 2 Policy가 없을수록 우선 검토             |

- PK 타입 결정은 엔티티 생성 시점에 한다(나중에 바꾸면 마이그레이션 비용이 크다).
- 정수 PK + flat RBAC만 있는 동안에는 리소스 소유권 검증(Policy)이 IDOR의 1차 방어선이다(`05-access-control.md`).

## 대량 연산 (Bulk) & Unit of Work 규율

MikroORM은 Unit of Work(identity map + dirty checking)가 핵심이다. **단건/소규모는 UoW를 그대로 쓰고, 대량은 batch/native 경로**로 우회한다. `BaseRepository`(`src/common/base/base.repository.ts`)가 공통 메서드를 제공한다.

| 작업                | 방법                                                | 비고                                                                                |
| ------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 대량 INSERT         | `persist([...])` 후 **한 번** `flush()` (`saveAll`) | MikroORM이 multi-row INSERT로 자동 배칭(`batchSize` 기본 300)                       |
| 멱등 INSERT/동기화  | `upsertMany(rows, options)`                         | `INSERT ... ON CONFLICT`. 충돌 키는 `onConflictFields`로 지정                       |
| 대량 soft delete    | `bulkSoftDelete(where)`                             | 단일 `UPDATE`. UoW/identity map 우회 → 메모리 엔티티는 stale                        |
| 오프셋 페이지네이션 | `findPage(where, options)`                          | `findAndCount` → `R.page`(`{ list, count }`). 임의 페이지 점프 가능, deep page 느림 |
| 커서 페이지네이션   | `findPageByCursor(options)`                         | `findByCursor` → `R.cursorPage`. 안정 정렬(고유 키 포함) 필수. 무한 스크롤/대용량   |
| 대량 read-only 스캔 | `find(..., { disableIdentityMap: true })`           | 익스포트·배치 잡. identity map 메모리 누수 방지                                     |

요청 쪽은 `OffsetPageQuery`/`CursorPageQuery`/`KeywordQuery`(`src/common/base/dto/`)를 `IntersectionType`으로 조합한다(`06-naming-and-style.md` Query DTO 베이스). 응답은 `R.page`/`R.cursorPage`. **offset은 임의 페이지 점프가 필요할 때, cursor는 무한 스크롤·대용량**일 때 쓴다(cursor는 deep page 성능 저하가 없다).

**루프에서 단건 `save()` 호출 금지.** `save()`는 호출마다 `flush()`(= round-trip)한다. 여러 건은 `persist`로 모아 `saveAll`(단일 flush) 또는 `upsertMany`를 쓴다.

```typescript
// 나쁨: N flush = N round-trip
for (const dto of items) await repo.save(Entity.create(dto));

// 좋음: 1 flush, multi-row INSERT 배칭
await repo.saveAll(items.map((dto) => Entity.create(dto)));
```

**native 경로(`bulkSoftDelete`/`nativeUpdate`/`nativeDelete`)는 UoW를 우회**하므로, 같은 트랜잭션에서 이미 로드한 동일 엔티티는 stale해진다. 이후 재사용하지 않거나 `em.refresh()`/재조회로 갱신한다.

**동시성**: read-modify-write 경합이나 상태 전이가 치명적인 엔티티는 `VersionedEntity`(`src/common/base/versioned.entity.ts`)를 상속해 optimistic lock을 켠다.

## 트랜잭션 데코레이터

`@Transactional`은 **`@mikro-orm/decorators/legacy`에서 import**한다.

```typescript
import { Transactional } from '@mikro-orm/decorators/legacy';
```

- 이유: NestJS(SWC)가 ES(stage-3) 데코레이터를 런타임 지원하지 않아 legacy 데코레이터를 유지한다. ORM 설정도 `legacyDecorator: true`다.
- MikroORM v7에서 `@Transactional`은 정식 데코레이터로 승격되었으나, NestJS 호환을 위해 backend-template는 `/legacy` 경로를 사용한다.
- `@Transactional()` 내부에서 `eventEmitter.emit()`을 호출하지 않는다. DB 작업은 private `@Transactional()` 메서드로 분리하고, 이벤트는 트랜잭션 완료 후 발행한다(`04-layer-responsibility.md` 참조).
