# 쿼리 전략

backend-template는 조회/쓰기 성격에 따라 **3경로 규칙**으로 데이터 접근을 분리한다. MikroORM(Unit of Work)을 기본으로 하되, 복잡 조회는 Kysely 기반 ReadModel로 우회할 수 있다.

## 3경로 규칙

| 경로                                | 도구                       | 적용 대상                                                            |
| ----------------------------------- | -------------------------- | ------------------------------------------------------------------- |
| 도메인 내부 CRUD / 쓰기 / 단건 조회 | **MikroORM** (Repo+Service) | 생성·수정·삭제, FK 관계 로딩, 단건/소규모 목록 조회                  |
| 복잡 조회 · 대시보드 · 집계         | **Kysely ReadModel**       | 다중 JOIN, GROUP BY, 통계, 페이지네이션 집계. **읽기 전용**, 도메인 경계 무시 가능 |
| 도메인 간 읽기                      | **ReadService**            | 다른 도메인의 데이터가 필요할 때. Repo를 직접 공유하지 않는다       |

### 경로별 원칙

- **MikroORM (도메인 내부)**: 자기 모듈의 엔티티에 대한 CRUD와 단건/관계 조회는 항상 MikroORM Repository를 통한다. write는 반드시 ORM(Unit of Work)을 거친다. raw SQL로 write하지 않는다.
- **Kysely ReadModel (복잡 조회)**: ORM QueryBuilder로 표현하기 어렵거나 N+1/성능 문제가 있는 집계·대시보드·리포트성 조회는 Kysely로 작성한다. ReadModel은 **읽기 전용**이며, 효율을 위해 도메인 경계를 가로지르는 JOIN을 허용한다. 결과 타입은 명시적으로 선언한다(`any` 금지).
- **ReadService (도메인 간 읽기)**: A 도메인이 B 도메인의 데이터를 읽어야 하면 B의 `*ReadService`를 주입해 호출한다. **B의 Repository를 A에 직접 주입하지 않는다**(모듈 경계 보호). 같은 `*.module.ts`의 `forFeature`에 함께 등록된 엔티티는 예외(`05-layer-responsibility.md` 참조).

## Kysely 통합 규칙

- Kysely는 **MikroORM의 커넥션 풀을 재사용한다.** 별도 풀이나 별도 모듈을 만들지 않는다. (이중 풀은 커넥션 고갈·트랜잭션 분리 문제를 유발한다.)
- 첫 복잡 조회가 필요해지는 시점에 `'KYSELY'` provider **한 줄**을 추가해 MikroORM 커넥션 위에 Kysely 인스턴스를 올린다. 그 전에는 코드 플러밍을 미리 깔지 않는다.
- 이 문서는 규칙만 명문화한다. 실제 provider 배선(코드 플러밍)은 첫 사용 시점에 추가한다.

```typescript
// 예시(첫 복잡 조회 시 추가): MikroORM 커넥션을 Kysely에 재사용
// providers: [{ provide: 'KYSELY', useFactory: (orm: MikroORM) => buildKysely(orm), inject: [MikroORM] }]
```

## Load Strategy 매트릭스

`populate` 깊이에 따라 로딩 전략을 선택한다. 전역 기본값은 `LoadStrategy.JOINED`(`src/lib/database/mikro-orm.config.ts`).

| 상황                          | 전략                  | 비고                                              |
| ----------------------------- | --------------------- | ------------------------------------------------- |
| populate 깊이 ≤ 2             | `JOINED` (기본)       | 단일 JOIN 쿼리. 전역 기본값                       |
| populate 깊이 ≥ 3             | `SELECT_IN`           | 깊은 그래프는 쿼리별로 `SELECT_IN` 지정 (카테시안 폭발 방지) |
| cross-domain 리스트 조합      | **Assembler (batch)** | 목록을 ID로 모아 도메인별 배치 조회 후 메모리에서 조립 |

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

인덱스는 마이그레이션에서 idempotent SQL(`IF NOT EXISTS`)로 추가한다(`10-deployment.md` 참조).

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

| 상황                                       | 선택                       | 비고                                                                   |
| ------------------------------------------ | -------------------------- | ---------------------------------------------------------------------- |
| 일반 CRUD 엔티티                           | `integer` (기본)           | 가장 단순/효율                                                         |
| 대량 누적(이벤트 로그·점수·메시지 등)      | `bigint`                   | `integer`는 약 21.4억 행 상한. **MikroORM에서 bigint PK는 JS `string`으로 매핑**되는 점 주의 |
| 외부로 ID가 노출되고 열거(enumeration) 위험 | `uuid` (v7 권장)           | IDOR 표면 축소. 단 인덱스 크기↑·정렬 지역성↓. Tier 2 Policy가 없을수록 우선 검토 |

- PK 타입 결정은 엔티티 생성 시점에 한다(나중에 바꾸면 마이그레이션 비용이 크다).
- 정수 PK + flat RBAC만 있는 동안에는 리소스 소유권 검증(Policy)이 IDOR의 1차 방어선이다(`06-access-control.md`).

## 대량 연산 (Bulk) & Unit of Work 규율

MikroORM은 Unit of Work(identity map + dirty checking)가 핵심이다. **단건/소규모는 UoW를 그대로 쓰고, 대량은 batch/native 경로**로 우회한다. `BaseRepository`(`src/common/base/base.repository.ts`)가 공통 메서드를 제공한다.

| 작업                  | 방법                                                     | 비고                                                            |
| --------------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| 대량 INSERT           | `persist([...])` 후 **한 번** `flush()` (`saveAll`)      | MikroORM이 multi-row INSERT로 자동 배칭(`batchSize` 기본 300)   |
| 멱등 INSERT/동기화    | `upsertMany(rows, options)`                              | `INSERT ... ON CONFLICT`. 충돌 키는 `onConflictFields`로 지정   |
| 대량 soft delete      | `bulkSoftDelete(where)`                                  | 단일 `UPDATE`. UoW/identity map 우회 → 메모리 엔티티는 stale    |
| 오프셋 페이지네이션   | `findPage(where, options)`                               | `findAndCount` → `R.page`(`{ list, count }`). 임의 페이지 점프 가능, deep page 느림 |
| 커서 페이지네이션     | `findPageByCursor(options)`                              | `findByCursor` → `R.cursorPage`. 안정 정렬(고유 키 포함) 필수. 무한 스크롤/대용량 |
| 대량 read-only 스캔   | `find(..., { disableIdentityMap: true })`                | 익스포트·배치 잡. identity map 메모리 누수 방지                 |

요청 쪽은 `OffsetPageQuery`/`CursorPageQuery`/`KeywordQuery`(`src/common/base/dto/`)를 `IntersectionType`으로 조합한다(`07-naming-and-style.md` Query DTO 베이스). 응답은 `R.page`/`R.cursorPage`. **offset은 임의 페이지 점프가 필요할 때, cursor는 무한 스크롤·대용량**일 때 쓴다(cursor는 deep page 성능 저하가 없다).

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
- `@Transactional()` 내부에서 `eventEmitter.emit()`을 호출하지 않는다. DB 작업은 private `@Transactional()` 메서드로 분리하고, 이벤트는 트랜잭션 완료 후 발행한다(`05-layer-responsibility.md` 참조).
