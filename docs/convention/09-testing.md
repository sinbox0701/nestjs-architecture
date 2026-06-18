# 테스트 작성 가이드

backend-template의 테스트는 **단위(Unit)**, **통합(Integration)**, **E2E** 세 가지로 나뉜다.

```
┌─────────────────────────────────────────────────────────┐
│  E2E Test (supertest)                                    │
│  → HTTP 파이프라인: Auth, Validation, Guard, Response    │
│  → "API 계약이 지켜지는가?"                              │
├─────────────────────────────────────────────────────────┤
│  Integration Test (real DB)                              │
│  → Repository 쿼리, 트랜잭션, DB 제약조건                │
│  → "DB와 합쳐졌을 때 의도대로 동작하는가?"               │
├─────────────────────────────────────────────────────────┤
│  Unit Test (mock)                                        │
│  → Entity 도메인 로직, Service 분기, Guard 판단          │
│  → "이 클래스 단독으로 로직이 맞는가?"                   │
└─────────────────────────────────────────────────────────┘
```

---

## 0. 테스트 작성 전 — 케이스 enumeration (필수)

테스트 코드 작성 전에 검증 대상(메서드/엔드포인트)에 대해 아래 카테고리를 훑어 **해당되는 케이스를 먼저 나열한 뒤** 코드를 작성한다. happy path만 검증하고 끝내지 않는다. 이 절차는 `/test` 커맨드뿐 아니라 "테스트 만들자/짜줘" 같은 자연어 요청에도 동일 적용한다.

| #   | 카테고리         | 점검 질문                                                            |
| --- | ---------------- | -------------------------------------------------------------------- |
| 1   | Happy path       | 정상 입력 → 기대 결과                                                |
| 2   | 입력 경계값      | null / undefined / 빈 문자열·배열 / 0 / 음수 / 최대 길이             |
| 3   | 입력 형식 오류   | 잘못된 타입·형식 (DTO 검증은 E2E — service에서는 진입 후 분기에 집중)|
| 4   | 권한             | 비로그인 / 다른 역할 / 본인 리소스 아님                              |
| 5   | 상태 전이·멱등성 | 이미 처리됨 / 같은 입력 재실행 / 잘못된 상태에서 호출               |
| 6   | 자기참조·관계    | oldValue === newValue / 존재하지 않는 FK / 고아 레코드             |
| 7   | 외부 의존성 실패 | repo가 null/empty 반환 / DB 제약 위반 / 트랜잭션 롤백              |
| 8   | Side effect 검증 | 호출돼야 하는 mock 호출 여부 + **호출되면 안 되는 경로의 미호출 검증**|

---

## 테스트 타입 선택 기준

| 상황                                                   | 권장 방식              |
| ------------------------------------------------------ | ---------------------- |
| Entity 생성/수정, 상태 전이, 도메인 규칙 위반 예외     | 단위 테스트 (mock)     |
| Service 분기 로직, 조건부 호출 흐름, 이벤트 발행       | 단위 테스트 (mock)     |
| Guard/Policy 권한 판단 로직                            | 단위 테스트 (mock)     |
| MikroORM FilterQuery, soft delete, 날짜 조건 등        | 통합 테스트 (real DB)  |
| Repository 쿼리 정확성 (필터, JOIN, 페이지네이션)      | 통합 테스트 (real DB)  |
| 트랜잭션, cascade, unique 제약조건                     | 통합 테스트 (real DB)  |
| DTO Validation Pipe, Auth Guard, RolesGuard 동작       | E2E 테스트 (supertest) |
| API 응답 포맷 (`R.data`, `R.page` 구조)                | E2E 테스트 (supertest) |

### 레이어별 중복 검증 방지

상위 레이어에서 하위 레이어가 이미 검증한 로직을 다시 테스트하지 않는다. 테스트 실패 시 원인 분리가 가능해야 한다:

- **E2E 실패** → 파이프라인 설정 문제 (Guard, Pipe, Interceptor, 응답 포맷)
- **Integration 실패** → 쿼리/비즈니스 로직 문제
- **Unit 실패** → 도메인 로직/분기 조건 문제

---

## 실행 환경

### Jest 설정 파일 (3-tier)

| 설정 파일                     | 대상        | testMatch                                            |
| ----------------------------- | ----------- | ---------------------------------------------------- |
| `package.json` → `jest`       | 단위 테스트 | `<rootDir>/tests/**/unit/**/*.spec.ts`               |
| `tests/jest-integration.json` | 통합 테스트 | `<rootDir>/**/integration/**/*.integration.spec.ts`  |
| `tests/jest-e2e.json`         | E2E 테스트  | `<rootDir>/**/*.e2e-spec.ts`                         |

모든 설정은 `_utils/setup-test-env.ts`를 `setupFiles`로 로드해 `.env.test`를 주입하고, `@/` → `src/`, `@test-utils/` → `tests/_utils/` 모듈 별칭을 매핑한다.

### 실행 명령어

```bash
pnpm test                            # 단위 테스트 전체
pnpm test -- --watch                 # 단위 테스트 watch
pnpm test:integration                # 통합 테스트 (--runInBand)
pnpm test:e2e                        # E2E 테스트 (--runInBand, MIKRO_ORM_ENTITY_SOURCE=ts)
pnpm test:cov                        # 커버리지
pnpm typecheck                       # tsc --noEmit (swc는 타입 체크 안 함)
```

### 테스트 트랜스포머

Jest는 `@swc/jest`를 사용한다 (MikroORM v7이 ESM이므로 `ts-jest` 호환 불가). legacy 데코레이터 + decoratorMetadata가 켜져 있다.

> **주의**: `@swc/jest`는 타입 체킹을 하지 않는다. `pnpm typecheck`를 별도로 실행한다.

---

## 테스트 인프라 (`tests/_utils/`)

```
tests/
├── _utils/
│   ├── setup-test-env.ts          # .env.test 로드 (모든 jest config의 setupFiles)
│   ├── gwt.template.ts            # Given/When/Then 래퍼 (선택)
│   ├── helpers/
│   │   ├── db-test.helper.ts      # truncateAll (metadata 기반 자동 truncate)
│   │   └── orm-test.helper.ts     # buildTestOrmConfig, initTestOrm
│   └── testing-modules/
│       └── test-auth.guard.ts     # E2E 경량 패턴 인증 시뮬레이션
├── <도메인>/
│   ├── unit/*.spec.ts
│   ├── integration/*.integration.spec.ts
│   └── e2e/*.e2e-spec.ts
```

> `@test-utils`는 `tests/_utils`를 가리키는 모듈 별칭이다(`tsconfig.json` + jest `moduleNameMapper`).
> `tests/_utils/` 안의 파일은 테스트가 아닌 유틸리티다. `.spec.ts` 확장자를 쓰지 않는다.

### Metadata 기반 자동 truncate (`truncateAll`)

backend-template는 camp-backend의 수동 `TABLES_TO_TRUNCATE` 배열을 제거하고, **ORM 메타데이터에서 테이블 목록을 동적으로 도출**하는 `truncateAll(orm)`을 사용한다.

```typescript
// tests/_utils/helpers/db-test.helper.ts
export async function truncateAll(orm: MikroORM): Promise<void> {
  const meta = orm.getMetadata().getAll();
  const names = Object.values(meta)
    .filter((m) => Boolean(m.tableName) && !m.abstract && !m.embeddable && !(m as any).virtual)
    .map((m) => `"${m.schema ? m.schema + '"."' : ''}${m.tableName}"`);
  if (!names.length) return;
  await orm.em.getConnection().execute(`TRUNCATE TABLE ${names.join(', ')} RESTART IDENTITY CASCADE`);
}
```

- 엔티티를 추가해도 truncate 목록을 손댈 필요가 없다 (camp의 "목록 누락/FK 순서 의존" 버그군 제거).
- `RESTART IDENTITY CASCADE`로 시퀀스 초기화 + 의존 행 정리를 한 번에 수행한다.
- ORM 설정이 `createForeignKeyConstraints: true`(DB FK 켜짐)여도, `CASCADE`가 FK 의존 행까지 정리하므로 teardown 순서를 신경 쓸 필요가 없다.
- abstract / embeddable / virtual 엔티티는 실제 테이블이 없으므로 제외된다.

`beforeEach`에서 호출해 테스트 간 격리를 보장한다.

### 통합 테스트 ORM 설정

`tests/_utils/helpers/orm-test.helper.ts`의 `buildTestOrmConfig()`는 앱의 기본 `mikro-orm.config`(default export)를 그대로 반환한다. `initTestOrm()`으로 인스턴스를 초기화한다. 테스트마다 ORM 설정을 중복 정의하지 않는다.

```typescript
import { initTestOrm } from '@test-utils/helpers/orm-test.helper';
import { truncateAll } from '@test-utils/helpers/db-test.helper';
```

---

## 1. 단위 테스트 (Unit)

NestJS DI 없이 클래스를 직접 `new`로 생성하고, 의존성은 `jest.fn()` mock으로 주입한다.

### Mock Factory 패턴 (필수)

Mock은 **명시적 인터페이스 + builder 함수** 패턴을 사용한다.

```typescript
// ✅ 명시적 인터페이스 + builder
interface MockNoteRepo {
  findById: jest.Mock;
  findByIdWithComments: jest.Mock;
  save: jest.Mock;
}

function buildMockNoteRepo(overrides: Partial<MockNoteRepo> = {}): MockNoteRepo {
  return {
    findById: jest.fn(),
    findByIdWithComments: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// 주입 시 as any 허용 (mock 인터페이스가 정의된 경우)
const mockRepo = buildMockNoteRepo();
service = new NoteService(mockRepo as any);
```

### 예외 검증 패턴

```typescript
// ✅ 에러 코드 구조 검증 (권장)
await expect(service.update(999, dto)).rejects.toMatchObject({
  response: { error: { code: '404_NOTE_001' } },
});

// ✅ Exception Factory 메시지 매칭 (코드가 없을 때)
await expect(service.update(999, dto)).rejects.toHaveProperty('message', NOTE_EXCEPTIONS.NOT_FOUND().message);

// ✅ 동기 예외
expect(() => note.changeStatus(Status.DONE)).toThrow(NOTE_EXCEPTIONS.INVALID_TRANSITION().message);
```

**우선순위**: `toMatchObject({ response.error.code })` > `toHaveProperty('message')` > `toThrow(message)`.
느슨한 `toBeInstanceOf(HttpException)`, `try/catch + fail()` 패턴은 쓰지 않는다.

---

## 2. 통합 테스트 (Integration)

실제 PostgreSQL(`backend_template_test`)에 연결해 Service + Repository를 검증한다.

```typescript
describe('NoteService (Integration)', () => {
  let orm: MikroORM;
  let em: EntityManager;
  let service: NoteService;

  beforeAll(async () => {
    orm = await initTestOrm();
    await orm.schema.updateSchema();   // 엔티티 기준 스키마 동기화
    em = orm.em as EntityManager;
    service = new NoteService(new NoteRepository(em));
  });

  afterAll(async () => {
    await orm.close();
  });

  beforeEach(async () => {
    await truncateAll(orm);            // metadata 기반 자동 truncate
  });

  it('soft-deleted note는 기본 조회에서 제외된다', async () => { ... });
});
```

- `--runInBand` 필수 (DB 상태 공유).
- 데이터 생성은 `em.persist(entity)` + `await em.flush()` (v7에서 `persistAndFlush` 제거됨).
- Service 분기 로직은 Unit으로, HTTP 파이프라인은 E2E로 보낸다.

---

## 3. E2E 테스트 (supertest)

`supertest`로 HTTP 요청을 보내 NestJS 파이프라인 전체를 검증한다. **Unit/Integration에서 검증할 수 없는 것**만 E2E에서 테스트한다: Validation Pipe, AuthGuard(401), RolesGuard(403), 응답 포맷, 에러 응답 구조.

### 경량 패턴 (기본)

개별 Controller + mock Service를 등록하고, `TestAuthGuard`로 인증을 시뮬레이션한다. 기본 `TestAuthGuard`(`tests/_utils/testing-modules/test-auth.guard.ts`)는 항상 통과시키며 `request.user = { id: 1, roles: [RoleCode.ADMIN] }`를 주입한다. 다른 역할을 검증해야 하면 테스트에서 별도 가드(또는 헤더 기반 가드)를 정의한다.

```typescript
import { TestAuthGuard } from '@test-utils/testing-modules/test-auth.guard';

const moduleRef = await Test.createTestingModule({
  controllers: [NoteController, NoteAdminController],
  providers: [
    { provide: APP_GUARD, useClass: TestAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: NoteService, useValue: buildMockNoteService() },
    Reflector,
  ],
}).compile();

app = moduleRef.createNestApplication();
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
await app.init();
```

```typescript
// 진짜 E2E — supertest로 전체 파이프라인 검증
await request(app.getHttpServer())
  .post('/admin/notes')
  .send({ title: '제목', content: '내용' })
  .expect(201);
```

### 전체 앱 패턴 (예외적)

실제 인증 플로우나 DB 상태가 필요할 때만 `imports: [AppModule]` + real DB를 쓴다.

> **주의**: Controller를 직접 `new`로 생성하는 테스트는 E2E가 아니다. `.spec.ts`(단위)로 분류한다.

---

## 5. 공통 규칙

### Enum/Type 사용 (하드코딩 금지)

테스트에서도 소스의 enum/type을 import해서 쓴다. 문자열 하드코딩 금지.

```typescript
// ❌ 하드코딩
expect(note.status).toBe('DONE');
request(app).set('x-test-role', 'USER');

// ✅ enum import
import { RoleCode } from '@/lib/access-control';
expect(note.status).toBe(NoteStatus.DONE);
request(app).set('x-test-role', RoleCode.USER);
```

### 테스트 설명 언어

- `describe`: 클래스/메서드명은 영문
- `it`: **국문 권장** — 비즈니스 요구사항을 한국어로 명확히 서술

### 구조 가이드라인

- `beforeEach`에서 mock/데이터를 초기화한다 (격리 보장).
- 한 `it` 블록에서 하나의 행위만 검증한다.
- 테스트 파일이 300줄을 넘으면 기능 단위로 분리를 고려한다.

---

## 6. MikroORM v7 테스트 유의사항

| 항목              | v6                                        | v7                                       |
| ----------------- | ----------------------------------------- | ---------------------------------------- |
| 테스트 트랜스포머 | `ts-jest`                                 | `@swc/jest`                              |
| 스키마 동기화     | `orm.getSchemaGenerator().updateSchema()` | `orm.schema.updateSchema()`              |
| 데이터 시드       | `em.persistAndFlush(entity)`              | `em.persist(entity); await em.flush()`   |
| 데코레이터 import | `from '@mikro-orm/core'`                  | `from '@mikro-orm/decorators/legacy'`    |
| `@Transactional`  | `NESTED` (savepoint)                      | `REQUIRED` (상위 트랜잭션 합류)          |
