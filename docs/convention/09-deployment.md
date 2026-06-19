# 배포 및 마이그레이션 관리

## 환경 구분

| 환경      | APP_ENV | NODE_ENV      | 용도                | DB 스키마 관리   |
| --------- | ------- | ------------- | ------------------- | ---------------- |
| 로컬 개발 | `dev`   | `development` | 개발자 워크스테이션 | 엔티티 auto-sync |
| 스테이징  | `stage` | `production`  | 통합테스트 / QA     | migration guard  |
| 프로덕션  | `prod`  | `production`  | 프로덕션            | migration guard  |

`NODE_ENV`는 `APP_ENV`에서 유도된다 (dev→development, stage/prod→production).

## DB 스키마 관리

### APP_ENV=dev (로컬): 엔티티 기반 자동 싱크

로컬에서는 `pnpm` 스크립트로 엔티티 기준 스키마를 동기화하며 개발한다. migration 파일 없이 엔티티만 수정해 빠르게 반복한다.

```bash
pnpm migration:fresh   # 또는 schema:update 류 — 엔티티 기준 재구성 (로컬 전용)
```

### APP_ENV=stage/prod: migration 기반

stage/prod에서는 **마이그레이션 기반**으로 동작한다. pending migration이 있으면 앱 시작을 거부하도록 운영한다. 배포 전에 반드시 마이그레이션을 실행한다.

## 마이그레이션 워크플로

### 1. 엔티티 수정 (local)

로컬에서 엔티티를 수정하고 auto-sync로 즉시 반영해 개발/테스트한다.

### 2. migration 파일 생성

PR 올리기 전, 엔티티 변경이 있으면 반드시 migration을 생성한다.

```bash
pnpm migration:create
```

- local DB의 현재 스키마와 엔티티 정의의 diff를 기반으로 SQL이 생성된다.
- 생성된 파일을 열어 SQL이 의도와 맞는지 반드시 확인한다.
- 빈 migration이 생성되면(diff 없음) 파일을 삭제한다.
- 생성 직후 **로컬 검증**을 돌린다 (아래 `pnpm migration:verify`).

### 3. 로컬 Migration 검증 (`pnpm migration:verify`)

`_fix_`/`_repair_` 수정 마이그레이션이 양산되는 것을 막기 위해, 생성한 마이그레이션을 깨끗한 임시 DB에 적용해본다.

```bash
pnpm migration:verify
```

동작 (`scripts/migration-verify.sh`):

1. 임시 PostgreSQL 컨테이너(`postgres:17.6-alpine`)를 격리 포트로 기동한다.
2. DB ready 대기 후 `mikro-orm migration:up`으로 pending 마이그레이션을 적용한다.
3. 에러 없이 적용되면 통과, 컨테이너는 자동 정리(`trap cleanup EXIT`)된다.

- `migration:create` 후 개발자가 수동 실행하는 것을 권장한다.
- 선택적으로 CI 단계에 통합할 수 있다(현 CI는 `test:integration`/`test:e2e`로 스키마 정합성을 간접 검증한다).

### 4. 커밋에 포함

```bash
git add migrations/MigrationYYYYMMDDHHMMSS_description.ts
```

migration 파일은 엔티티 변경과 같은 PR에 포함시킨다.

### 5. 배포

PR이 머지되면 배포 파이프라인이 마이그레이션을 실행한 뒤 앱을 기동한다(`build → migrate → up → health check`). pending migration이 있으면 stage/prod 앱은 부팅을 거부한다.

## 마이그레이션 규칙

| 규칙                         | 이유                                               |
| ---------------------------- | -------------------------------------------------- |
| migration 파일은 PR에 포함   | stage/prod에서 엔티티만 바뀌면 앱 시작 실패        |
| 실행된 migration은 수정 금지 | 이미 적용된 SQL을 바꾸면 환경 간 불일치 발생       |
| rollback은 새 migration으로  | down migration 대신 새 up migration으로 되돌림     |
| 생성된 SQL은 반드시 검수     | 자동 생성 SQL이 의도와 다를 수 있음                |
| **Idempotent SQL 사용**      | fresh DB와 기존 DB 모두에서 안전하게 실행되어야 함 |

### Idempotent Migration 규칙

새로 작성하는 migration은 **어떤 DB 상태에서도 안전하게** 실행되어야 한다.

```sql
-- ✅ Idempotent — 이미 존재해도 에러 없음
CREATE INDEX IF NOT EXISTS idx_foo ON "bar" ("col");
CREATE TABLE IF NOT EXISTS "foo" (...);
ALTER TABLE "foo" ADD COLUMN IF NOT EXISTS "bar" text;
DROP INDEX IF EXISTS idx_foo;

-- ❌ Non-idempotent — 이미 존재하면 에러
CREATE INDEX idx_foo ON "bar" ("col");
ALTER TABLE "foo" ADD COLUMN "bar" text;
```

**배경**: fresh DB 셋업 시 초기 CREATE 마이그레이션으로 엔티티 기반 테이블을 만들고, 이후 마이그레이션을 적용한다. idempotent하지 않으면 이 경로에서 실패할 수 있다.

### 파괴적 변경 (컬럼 삭제, 타입 변경)

stage/prod 운영 중에는 2단계로 나눈다:

```
배포 1: 새 컬럼 추가 + 코드에서 양쪽 다 읽기/쓰기
배포 2: 구 컬럼 삭제 + 코드에서 새 컬럼만 사용
```

dev에서는 한 번에 처리해도 무방하다.

### 파일 네이밍

MikroORM이 자동 생성하는 `MigrationYYYYMMDDHHMMSS.ts` 형식을 따르되, 내용을 알 수 있도록 suffix를 추가한다:

```
Migration20260320100000_add_owner_id_to_notes.ts
```

마이그레이션 테이블명은 `backend_template_migrations`이며 `migrations/` 디렉터리에 위치한다(`src/lib/database/mikro-orm.config.ts`).

## Baseline 전진 / Squash 절차

시간이 지나면 마이그레이션 파일이 누적된다. MikroORM v7에는 native squash가 없으므로, 주기적으로 baseline cutoff를 전진시키고 그 이전 파일을 정리한다.

> backend-template는 초기 스키마를 단일 CREATE 마이그레이션(`Migration20260101000000_init.ts`)으로 시작한다. 첫 baseline cutoff는 이 init 마이그레이션이다.

**목표**: post-cutoff 파일 수를 합리적인 수준(예: 20개 이내)으로 유지.

**절차**:

1. 모든 환경(dev/stage/prod)에서 pending migration = 0 확인.
2. 새 cutoff 지점 결정 — 최소 1주 이상 전 환경에서 실행 완료된 마이그레이션.
3. (baseline 로직이 있다면) `BASELINE_CUTOFF` 상수를 새 지점으로 업데이트.
4. fresh DB의 `schema.create()` 결과와 migrated DB가 일치하도록, migration-only 객체(partial index, custom CHECK 등)를 보정하는 sync 마이그레이션을 갱신한다.
5. cutoff 이전 마이그레이션 파일을 `migrations/`에서 삭제.
6. PR 머지 후 fresh DB 부트스트랩 테스트(`pnpm migration:verify`)로 검증.

**주기**: 매월 또는 스프린트 종료 시.

**주의사항**:

- 삭제 전 모든 환경의 `backend_template_migrations` 테이블에 해당 기록이 존재하는지 확인한다.
- 롤백 미사용(roll-forward) 정책이면 삭제된 파일의 `down()` 소실은 무해하다.

### fresh DB 스키마 정합성

`schema.create()`는 엔티티 데코레이터 기반 DDL만 생성한다. partial index(`WHERE` 절), custom CHECK constraint 등 migration-only 객체는 누락된다. baseline 전진 시 두 DB를 비교해 보정 마이그레이션을 갱신한다.

```bash
pg_dump --schema-only -d backend_template_fresh    > schema_fresh.sql
pg_dump --schema-only -d backend_template_migrated > schema_migrated.sql
diff schema_fresh.sql schema_migrated.sql
```

> 상세 배경과 운영 가이드는 (필요 시) `docs/tech-debt/migration-management.md`에 별도 정리한다.

## CI/CD

### CI (`.github/workflows/ci.yml`)

- 트리거: PR → main.
- services: `postgres:17.6`, `redis:8.2`.
- 단계: 마이그레이션 드리프트 체크(차단) → install → `lint:check` → `typecheck` → `dep:check`(모듈 경계, dependency-cruiser) → `build` → `test`(unit) → `test:integration` → `test:e2e` (`.env.test` 사용).

### CD

- 트리거: main 머지.
- 동작: `build → migrate → up → health check`. pending migration이 있으면 stage/prod 부팅 실패로 정합성을 강제한다.

## Secret 관리

- `.env` 파일은 git에 커밋하지 않는다 (`.env.test`만 예외 — localhost 전용, 비밀 없음).
- 민감 정보(DB 비밀번호, JWT/세션 시크릿 등)는 환경변수로만 주입한다.
