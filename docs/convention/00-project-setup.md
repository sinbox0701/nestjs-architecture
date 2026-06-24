# 프로젝트 설정

프로젝트의 기술 스택, 빌드/린트/CI 파이프라인 구성, 그리고 이 설정을 변경하는 방법을 설명한다.

## 기술 스택

| 항목            | 기술       | 버전 | 비고                                                   |
| --------------- | ---------- | ---- | ------------------------------------------------------ |
| Runtime         | Node.js    | 24+  | `package.json` engines 필드 참조                       |
| Language        | TypeScript | 5.9+ | strict 모드                                            |
| Framework       | NestJS     | 11.x | SWC 빌드 (`nest build`가 내부적으로 SWC 사용)          |
| ORM             | MikroORM   | 7.x  | Unit of Work 패턴, `@mikro-orm/decorators/legacy` 사용 |
| DB              | PostgreSQL | -    | 로컬은 Docker Compose로 실행                           |
| Cache           | Redis      | -    | graceful degradation 지원 (`safe*` 메서드)             |
| Package Manager | pnpm       | 10.x | corepack으로 관리                                      |
| Test            | Jest       | 30.x | `@swc/jest` 트랜스포머, 단위/통합/e2e 분리             |

### MikroORM v7 import 규칙

```typescript
// 데코레이터는 반드시 /legacy 경로에서
import { Entity, Property, ManyToOne } from '@mikro-orm/decorators/legacy';

// 타입/유틸리티는 @mikro-orm/core에서 허용
import { Ref, ref, Cascade, Collection } from '@mikro-orm/core';

// EntityManager, FilterQuery는 postgresql 드라이버에서
import { EntityManager, FilterQuery } from '@mikro-orm/postgresql';
```

- `@mikro-orm/decorators` (without `/legacy`)는 ESLint error. 새 스타일 데코레이터는 팀 합의 전까지 사용하지 않는다.
- 이유: SWC 설정이 `legacyDecorator: true`로 되어 있어 새 스타일 데코레이터는 런타임에 동작하지 않는다.

## 스크립트

### 개발

| 스크립트         | 용도                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| `pnpm start:dev` | 로컬 개발 서버 (watch + type-check + SWC, 기동 전 `metadata` 자동 실행)                                    |
| `pnpm build`     | 프로덕션 빌드 (`nest build`, prebuild로 `metadata` 자동 실행)                                              |
| `pnpm typecheck` | 타입 체크만 (`tsc --noEmit`)                                                                               |
| `pnpm metadata`  | Swagger OpenAPI 메타데이터 생성 (`src/metadata.ts`). JSDoc→Swagger 파이프라인. build/start:dev가 자동 호출 |

### 린트/포맷

| 스크립트            | 용도                                                                    |
| ------------------- | ----------------------------------------------------------------------- |
| `pnpm lint`         | ESLint 실행 + 자동 수정 (`--fix`). 개발 중 사용                         |
| `pnpm lint:check`   | ESLint 실행 (수정 없음). CI에서 사용                                    |
| `pnpm format`       | Prettier 포맷 적용                                                      |
| `pnpm format:check` | Prettier 포맷 체크만                                                    |
| `pnpm dep:check`    | 모듈 경계 검사 (dependency-cruiser, `.dependency-cruiser.cjs`). CI 차단 |

### 테스트

| 스크립트                | 용도                                 |
| ----------------------- | ------------------------------------ |
| `pnpm test`             | 단위 테스트 (`*.spec.ts`)            |
| `pnpm test:integration` | 통합 테스트 (실제 DB, `--runInBand`) |
| `pnpm test:e2e`         | E2E 테스트                           |

### 마이그레이션

| 스크립트                | 용도                                        |
| ----------------------- | ------------------------------------------- |
| `pnpm migration:create` | 새 마이그레이션 파일 생성                   |
| `pnpm migration:up`     | 마이그레이션 적용                           |
| `pnpm migration:down`   | 마이그레이션 롤백                           |
| `pnpm migration:list`   | 마이그레이션 목록 확인                      |
| `pnpm migration:verify` | 임시 DB로 pending 마이그레이션 dry-run 검증 |

> 마이그레이션 테이블명: `backend_template_migrations`

## ESLint 설정

### 구조

`eslint.config.mjs`는 ESLint v10 flat config를 사용한다. 하나의 배열에 여러 config 객체를 두는 방식이다.

```
[기본 룰 (전체 *.ts)]
  → typescript-eslint recommended
  → prettier
  → import sorting
  → unused imports
  → 컨벤션 룰 (no-restricted-imports, no-restricted-syntax)

[파일별 override]
  → *.service.ts, *.handler.ts: 인라인 예외 금지 + unwrap 경고
  → *.controller.ts: 인라인 예외 금지 + repository 호출 금지 + unwrap 경고
  → *.dto.ts: @ApiProperty 금지 + unwrap 경고

[ignores]
  → dist, node_modules, metadata.ts
```

### 컨벤션 룰 추가하기

1. `eslint.config.mjs`를 열고 적절한 위치에 룰을 추가한다.
2. `no-restricted-syntax`를 사용하면 AST 셀렉터로 거의 모든 코드 패턴을 잡을 수 있다.
3. 특정 파일에만 적용하려면 `files: ['**/*.xxx.ts']` override 블록을 만든다.

```javascript
// 예: *.repository.ts 파일에서 console.log 금지
{
  files: ['**/*.repository.ts'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.object.name='console']",
        message: 'Repository에서 console.log 사용 금지. FrameworkLogger를 사용하세요.',
      },
    ],
  },
},
```

**주의: flat config에서 같은 rule을 여러 블록에서 정의하면 마지막 블록이 이전을 덮어쓴다.** 예를 들어 `*.controller.ts`에 대해 기본 블록과 override 블록 둘 다 `no-restricted-syntax`를 정의하면, override 블록의 정의만 살아남는다. 따라서 override 블록에는 해당 파일에 필요한 **모든 셀렉터**를 포함해야 한다.

### 컨벤션 룰 수정/제거하기

1. `eslint.config.mjs`에서 해당 룰을 찾아 수정하거나 삭제한다.
2. 파일별 override 블록에 같은 셀렉터가 중복되어 있을 수 있으므로 모든 블록을 확인한다.
3. `pnpm lint:check`로 변경 후 기존 코드에 영향이 없는지 확인한다.
4. 룰의 단일 출처는 `eslint.config.mjs`다. 변경이 컨벤션 의미에 영향을 주면 관련 `docs/convention/` 문서를 함께 갱신한다.

### warn → error 승격

warn으로 시작한 룰을 error로 올릴 때:

1. `pnpm lint:check`로 현재 warn 건수를 확인한다.
2. warn 대상 코드를 모두 수정하는 cleanup PR을 먼저 올린다.
3. cleanup이 머지된 후 severity를 `error`로 변경한다.
4. `pnpm lint:check`로 error 0건을 확인한다.

## Pre-commit Hook

`.husky/pre-commit`에서 `pnpm lint-staged`를 실행한다.

```json
// package.json
"lint-staged": {
  "*.{js,jsx,ts,tsx}": ["eslint --fix"]
}
```

- 커밋 시 변경된 파일에만 ESLint `--fix`가 동작한다.
- 수정 불가능한 error가 있으면 커밋이 차단된다.

`.husky/pre-commit`는 두 가지를 실행한다:

```bash
pnpm lint-staged                              # 변경된 TS에 eslint --fix
node scripts/check-entity-migration.mjs --warn  # 엔티티↔마이그레이션 드리프트 (비차단 경고)
```

- 드리프트 가드: `*.entity.ts`가 바뀌었는데 새 마이그레이션이 없으면 경고한다. dev 반복을 막지 않도록 `--warn`(비차단)이며, CI에서는 `--base`로 차단한다.

### Claude Code 자동 포맷 훅

`.claude/settings.json`(공유·추적)에 Stop 훅이 설정되어 있다. Claude가 **작업(턴)을 마치고 멈출 때 1회** `scripts/claude-format.mjs`가 그동안 변경된 TS/JS 파일(git 워킹트리)에 `prettier --write` + `eslint --fix`를 일괄 적용한다(매 편집마다 돌지 않아 빠르고, 커밋 전 워킹트리를 깔끔하게 유지). husky pre-commit과 달리 **Claude 세션 중에만** 동작하므로, 사람이 IDE에서 직접 짠 코드는 커밋 시 lint-staged가 처리한다. 비활성화하려면 이 훅 항목을 삭제한다.

## 환경 변수

- `.env` 단일 파일에 모든 환경변수를 관리한다. `APP_ENV`로 환경을 구분한다.
- `.env.test`는 테스트 전용 환경변수 파일이며, 로컬호스트 기준으로 설정되어 있고 **git-tracked**된다.
- 환경변수 스키마 검증은 `src/config/env.schema.ts`에서 **zod**로 수행한다.

## CI 파이프라인

`.github/workflows/ci.yml`에서 PR마다 실행된다. GitHub Actions를 사용하며, Node.js 24 + pnpm + PostgreSQL + Redis 서비스 컨테이너를 구동한다.

```
1. Checkout
2. 마이그레이션 드리프트 체크 (엔티티 변경에 마이그레이션 누락 시 차단)
3. 컨벤션 문서 참조 정합성 체크 (doc:check — stale `NN-*.md` 참조 차단)
4. 하네스 config 정합성 체크 (config:check — `.claude/config.json` 파싱/키)
5. pnpm 설정 + Node.js 24 + install
6. lint:check
7. format:check
8. typecheck
9. dep:check (모듈 경계 — dependency-cruiser)
10. build
11. test (단위)
12. test:integration (실제 DB)
13. test:e2e
```

- **드리프트 체크가 가장 앞**이다 (base 대비 `*.entity.ts` 변경에 마이그레이션 누락이면 차단). 로컬 husky는 경고(비차단)지만 CI는 차단.
- **`dep:check`(dependency-cruiser)가 build 앞**에 있다. 모듈 경계 위반(`02-module-rules.md`)을 빌드 전에 차단한다.
- **lint:check가 build보다 앞에 위치**한다. 린트 실패 시 빌드를 기다리지 않고 빠르게 실패한다.
- `pnpm lint:check`는 `--fix` 없이 실행되므로, 위반이 있으면 PR이 실패한다.
- GitHub-hosted runner를 사용한다 (self-hosted 아님).

### CI 수정

- 새 step 추가: `ci.yml`의 steps 배열에 추가한다.
- 린트 스크립트 변경: `pnpm lint:check` 부분을 수정한다.

## 설정 파일 위치 요약

| 파일                                   | 역할                                        | git-tracked |
| -------------------------------------- | ------------------------------------------- | ----------- |
| `eslint.config.mjs`                    | ESLint 룰 정의                              | ✅          |
| `package.json`                         | 스크립트, 의존성, lint-staged, jest 설정    | ✅          |
| `.husky/pre-commit`                    | 커밋 전 hook (lint-staged + 드리프트 가드)  | ✅          |
| `scripts/check-entity-migration.mjs`   | 엔티티↔마이그레이션 드리프트 가드           | ✅          |
| `scripts/claude-format.mjs`            | PostToolUse 포맷 훅 (prettier+eslint)       | ✅          |
| `.claude/settings.json`                | Claude Code 훅 (Stop 시 자동 포맷, 공유)    | ✅          |
| `.claude/config.json`                  | 프로젝트별 통합 타깃 (linear, frontend)     | ✅          |
| `.claude/settings.local.json`          | Claude Code 개인 설정 (선택, allowlist 등)  | ❌          |
| `.github/workflows/ci.yml`             | PR CI 파이프라인                            | ✅          |
| `src/config/env.schema.ts`             | zod 환경변수 스키마                         | ✅          |
| `src/lib/database/mikro-orm.config.ts` | MikroORM 설정                               | ✅          |
| `.env`                                 | 환경변수 (단일 파일, `APP_ENV`로 환경 구분) | ❌          |
| `.env.test`                            | 테스트 환경변수 (로컬호스트 기준)           | ✅          |
