# Backend Template

도메인 비종속 NestJS 백엔드 스타터 (NestJS 11 + MikroORM v7 + PostgreSQL + Redis).
새 도메인은 `src/modules/` 아래에 추가한다 (`auth`·`identity`가 RBAC+ABAC 레퍼런스 구현으로 들어 있음).

## 기술 스택

- Runtime: Node.js 24, TypeScript (strict)
- Framework: NestJS 11 (SWC 빌드)
- ORM: MikroORM v7 (Unit of Work, **legacy 데코레이터**)
- DB: PostgreSQL / Cache: Redis
- Config: zod typed config (`src/config/`)
- Package Manager: pnpm
- Test: Jest 30 (`@swc/jest`) — unit / integration / e2e

## 컨벤션 (필수)

코드를 작성/수정할 때 반드시 `docs/convention/` 문서를 따른다. 작업 범위에 해당하는 문서를 먼저 읽는다.

| 문서                         | 핵심                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `00-project-setup.md`        | 기술 스택, ESLint/CI/Hook 설정                                                              |
| `01-project-structure.md`    | 도메인 우선 배치, `src/` 구조                                                               |
| `02-module-rules.md`         | 동기=imports/exports, 비동기=이벤트                                                         |
| `03-module-patterns.md`      | Compact Feature / Role-Folder / Domain-Driven                                               |
| `04-layer-responsibility.md` | Controller→Service→Repository→Entity 책임, MikroORM 관계                                    |
| `05-access-control.md`       | 팀 스코프 RBAC + 소유권 ABAC, default-deny, 3-tier (`@Requires`/PolicyGuard/ResourcePolicy) |
| `06-naming-and-style.md`     | 네이밍, DTO 명명, 메서드명 규칙                                                             |
| `07-env-setup.md`            | zod typed config, `.env`/`.env.test`, Docker                                                |
| `08-testing.md`              | 단위/통합/e2e 패턴, metadata 기반 `truncateAll`                                             |
| `09-deployment.md`           | 환경 구분, 마이그레이션 관리, Baseline 전진/squash                                          |
| `10-query-strategy.md`       | 3경로 쿼리 규칙, Load Strategy, 인덱스 원칙                                                 |
| `11-api-design.md`           | REST URL/리소스 규칙, HTTP 메서드·상태코드, 설계 가드레일                                   |
| `12-observability.md`        | 로깅/트레이싱(OTel)/요청 컨텍스트/전역 에러·응답 파이프라인                                 |

## 핵심 원칙 (DO/DON'T)

### 1. Typed Config

- 환경 변수는 `src/config/env.schema.ts`의 zod 스키마로 부팅 시 검증한다. 빈 문자열은 "누락"으로 취급한다.
- 도메인 특화 키는 스타터에 넣지 않고 도메인 단계에서 스키마를 확장한다.

### 2. Legacy ORM 데코레이터

```typescript
// DO: 데코레이터는 /legacy 경로
import { Entity, Property, ManyToOne } from '@mikro-orm/decorators/legacy';
import { Transactional } from '@mikro-orm/decorators/legacy';
// 타입/유틸은 @mikro-orm/core, EM/FilterQuery는 @mikro-orm/postgresql
```

- 이유: SWC가 ES 데코레이터를 런타임 지원하지 않음 (`legacyDecorator: true`). `@mikro-orm/decorators`(non-legacy) import는 금지.

### 3. Exception Factory 패턴

```typescript
// DON'T: 인라인 예외
throw new HttpException('not found', 404);
throw new Error('...');

// DO: exception/ 폴더의 팩토리 상수 (베이스: src/common/exceptions/http.exception.ts)
throw NOTE_EXCEPTIONS.NOT_FOUND();
```

### 4. 로깅 — console.log 금지

- `console.log`/`console.error`를 쓰지 않는다. `FrameworkLogger`(`src/core/logger/`)를 사용한다.
- 로그에 추적 가능한 식별자(id 등)를 포함한다.

### 5. 접근제어 — 역할 capability RBAC + 소속팀 소유권 ABAC (default-deny)

```typescript
// 실제 예: src/modules/identity/controller/user.controller.ts
import { Requires, Action, CurrentUser, AuthSubject } from '@/lib/access-control';

@Requires(Action.UPDATE, 'user') // Tier1: 역할(Role) capability (없으면 default-deny로 거부)
@Patch(':id')
update(@CurrentUser() actor: AuthSubject, @Param('id') id: number, @Body() body: UpdateUserRequest) {
  return this.service.updateUser(actor, id, body); // Tier2: service에서 loadAndAuthorize/authorize
}
```

- 보호 라우트는 `@Requires` 또는 `@Public()`이 **반드시** 있어야 한다(default-deny). 인증만으론 통과 못 함.
- Tier0 인증(`AuthGuard`+blocklist) → Tier1 RBAC(`PolicyGuard`, 역할 capability) → Tier2 ABAC(`ResourcePolicy`, 소속팀 소유). 상세: `05-access-control.md`.
- 엔진 + **`identity` 레퍼런스 구현**(역할×액션 매트릭스·`UserResourcePolicy`·로그인/토큰)을 제공. 새 도메인은 자신의 매트릭스·정책을 만들어 `ACCESS_POLICY_PROVIDER`에 바인딩한다.

### 6. 3경로 쿼리 전략

- 도메인 내부 CRUD/쓰기/단건 → **MikroORM** (Repo+Service)
- 복잡 조회·대시보드·집계 → **Kysely ReadModel** (읽기 전용, MikroORM 커넥션 풀 재사용)
- 도메인 간 읽기 → **ReadService** (다른 도메인 Repo 직접 주입 금지)

### 7. 테스트 — metadata 자동 truncate

- 통합 테스트는 `backend_template_test` DB(`.env.test`, committed)에 연결. `beforeEach`에서 `truncateAll(orm)` 호출 — 엔티티 메타데이터에서 테이블 목록을 자동 도출하므로 수동 목록 유지 불필요.
- `@swc/jest`는 타입 체크를 안 하므로 `pnpm typecheck`를 별도 실행.

### 8. DTO 스타일

- 행위별 bundled `.dto.ts` (Request + Response 한 파일). `.request.ts`/`.response.ts` 분리 금지.
- 클래스명: `행위 + 대상 + Request/Response` (예: `CreateNoteRequest`). 전역에서 약한 이름(`CreateRequest`) 금지.
- DTO 필드는 union 대신 enum (orval 호환). nullable은 `?:` optional, `| null` 금지.

## 명령어

| 작업        | 명령                                                    |
| ----------- | ------------------------------------------------------- |
| 개발        | `pnpm start:dev`                                        |
| 빌드        | `pnpm build`                                            |
| 타입체크    | `pnpm typecheck`                                        |
| 린트        | `pnpm lint` (--fix) / `pnpm lint:check` (CI)            |
| 포맷        | `pnpm format` / `pnpm format:check`                     |
| 테스트      | `pnpm test` · `pnpm test:integration` · `pnpm test:e2e` |
| 시드        | `pnpm seed` (core) · `pnpm mock:seed` (faker, dev 전용) |
| 로컬 인프라 | `pnpm docker:up` / `pnpm docker:down`                   |

## 마이그레이션 워크플로

```
로컬(dev): 엔티티 수정 → schema:update auto-sync
PR 전: pnpm migration:create → SQL 검수 → pnpm migration:verify (임시 DB dry-run)
배포: pnpm migration:up (stage/prod, pending 있으면 부팅 거부)
```

- 마이그레이션 테이블: `backend_template_migrations`. 파일: `migrations/`.
- Idempotent SQL 필수 (`IF NOT EXISTS`). 상세: `09-deployment.md`.
- 드리프트 가드(`scripts/check-entity-migration.mjs`): `*.entity.ts` 변경 시 마이그레이션 누락을 감지 — pre-commit 경고(비차단), CI 차단.

## Swagger / API 문서 (JSDoc 기반)

SWC 빌드는 `@nestjs/swagger` tsc 플러그인을 못 쓰므로, **빌드/기동 전 `pnpm metadata`가 `src/metadata.ts`를 생성**해 OpenAPI 메타데이터를 주입한다 (`prebuild`·`start:dev`에 배선됨, `scripts/generate-metadata.ts`).

- **컨트롤러 메서드 JSDoc 첫 줄 → operation summary** (orval 함수 설명·IDE 호버). `@ApiOperation()` 수동 선언 지양.
- **DTO 필드 JSDoc(`@example` 포함) + class-validator 데코레이터 → 스키마 설명·제약**. `@ApiProperty()` 지양.
- 컨트롤러 메서드명·DTO 클래스명·필드 enum이 orval로 FE 타입/함수명에 **직결**된다 → `06-naming-and-style.md` 참조.
- `src/metadata.ts`는 **생성물**이다: gitignore 대상, 직접 수정 금지, eslint 제외.
- 트러블슈팅: build/start 에러가 `src/metadata.ts`에서 나면 해당 파일을 지우고 `pnpm metadata`(또는 재빌드)로 재생성한다.

## SDD 파이프라인 (.claude/commands)

```
PRD 작성 → /spec → /issues → /scaffold → 코딩 → /review → /test → /migration → /fe-changes → /commit
```

파이프라인 외: `/mock-seed` (데브 서버 데이터), `/status` (현황). 스킬 총 10개.
PRD 템플릿: `docs/prd/_template.md`, 스펙 템플릿: `docs/prd/_spec-template.md`.

## 참고

- 컨벤션 상세: `docs/convention/` (README부터 시작).
- Linear/Orval 등 외부 연동 ID/경로는 `.claude/config.json`에 둔다 (스킬이 참조, 하드코딩 금지).
