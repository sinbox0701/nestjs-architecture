---
name: test
description: 08-testing.md 컨벤션 기반으로 테스트 코드를 작성/보완한다.
argument-hint: '<BE-XXX | spec_path | test_type module-name>'
---

테스트 코드를 작성하거나 보완한다. docs/convention/08-testing.md 컨벤션 기반.

## 인자 해석

| 입력                 | 모드        | 동작                                      |
| -------------------- | ----------- | ----------------------------------------- |
| BE-302               | 이슈 모드   | Linear 이슈 완료 조건 → 테스트 체크리스트 |
| docs/prd/xxx.spec.md | 스펙 모드   | 스펙 검증 조건 → 테스트 체크리스트        |
| unit order           | 컨벤션 모드 | convention만                              |
| all note             | 컨벤션 모드 | convention만                              |

이슈 모드: Linear MCP로 이슈 읽기 → 완료 조건/대상 모듈 파악 → 테스트 작성.
스펙 모드: 검증 조건 전체 추출 → 레이어/타입별 분류 → unit → integration → e2e 순서.
컨벤션 모드: 첫 인자 테스트 유형(unit/integration/e2e/all), 두 번째 인자 모듈명.

## 사전 준비

1. docs/convention/08-testing.md 읽기.
2. src/modules/<module-name>/ 소스 코드 분석.
3. 기존 테스트 확인 (tests/<module-name>/ 아래).
4. 소스 코드 로직 검증 — 이슈 보고 후 진행 여부 확인.

## 테스트 유형별 작성 절차

### unit

대상: Entity(create/update/상태전이), Service(분기/예외/이벤트), Guard/Policy, Handler
위치: tests/<module-name>/unit/<feature>.spec.ts

Mock Factory 패턴:
interface MockFooRepo { findById: jest.Mock; save: jest.Mock; }
function buildMockFooRepo(overrides = {}): MockFooRepo { return { findById: jest.fn(), save: jest.fn(), ...overrides }; }

예외 검증: toMatchObject({ response.error.code }) 또는 toHaveProperty 사용

### integration

대상: Repository 쿼리, Service+Repository 조합, DB 제약조건
위치: tests/<module-name>/integration/<feature>.integration.spec.ts

필수 패턴:

- beforeAll: 모듈 생성 + syncTestSchema(orm)
- afterAll: orm.close()
- beforeEach: truncateTestTables(em) + seedTestRoles(em)
- ORM 설정: @test-utils/helpers/orm-test.helper 의 buildTestOrmConfig() 사용

### e2e

대상: 인증/인가(401/403), DTO validation(400), 응답 포맷, 역할 분리
위치: tests/<module-name>/e2e/<module-name>.e2e-spec.ts

필수: supertest 사용, 경량 패턴(개별 Controller + mock Service + TestAuthGuard),
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })),
RoleCode.USER 등 enum 사용 (문자열 하드코딩 금지)

### all

unit → integration → e2e 순서로 모두 수행.

## 작성 후 검증

pnpm test -- tests/<module>/unit/
pnpm test:integration --runInBand -- tests/<module>/integration/
pnpm test:e2e -- tests/<module>/e2e/

## 규칙

- docs/convention/08-testing.md 패턴 반드시 따른다
- 레이어별 중복 검증 금지
- 잘못 분류된 .e2e-spec.ts 발견 시 .spec.ts로 리네이밍 제안
- 테스트 작성 후 반드시 실행하여 통과 여부 확인

## 커버리지 리포트 (이슈/스펙 모드)

| # | 완료 조건 | 테스트 파일:라인 | 상태 |
미커버 항목은 이유와 함께 보고.
