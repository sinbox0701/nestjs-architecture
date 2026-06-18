# 환경 설정 가이드

이 프로젝트는 모든 실행 경로에서 `.env` 단일 파일을 읽고, 환경 구분은 `APP_ENV`로 한다.

- `APP_ENV` — 배포 단계. 허용값: `dev`, `stage`, `prod`
- `NODE_ENV`는 `APP_ENV`에서 유도된다 (dev→development, stage/prod→production)

기본 원칙:

- 로컬 개발: `APP_ENV=dev`
- 통합/스테이징 서버: `APP_ENV=stage`
- 프로덕션: `APP_ENV=prod`

## 파일 구조

```text
.env            # 실제 환경변수 (gitignored)
.env.example    # 템플릿 (git-tracked)
.env.test       # 로컬 통합/E2E 테스트 전용 (git-tracked, localhost 전용)
```

`.env`는 Nest `ConfigModule`, MikroORM CLI, Docker Compose가 공유한다.

### 최초 설정

```bash
cp .env.example .env
```

복사한 뒤 실제 비밀값(DB 비밀번호, JWT/세션 시크릿, CORS 등)을 환경에 맞게 수정한다.

## Typed Config (zod)

환경 변수는 **zod 기반 typed config**로 검증한다. camp-backend의 Joi `.required().allow('')` 안티패턴(빈 문자열을 "값 있음"으로 취급)을 제거했다.

- 스키마: `src/config/env.schema.ts` — 모든 키가 명시적 default 또는 필수 여부를 갖는다.
- 로더/접근: `src/config/configs.ts`
- 동작:
  - 빈 문자열을 허용하지 않는다 (`''`은 "누락"으로 취급).
  - boolean/number는 문자열 env에서 강제 변환(coerce)한다.
  - 부팅 시 1회 `validateEnv(process.env)`로 parse → 런타임 타입 안전 확보.
  - 검증 실패 시 모든 이슈를 모아 에러를 던져 앱 시작을 막는다.

```typescript
// @nestjs/config validate 훅
ConfigModule.forRoot({ isGlobal: true, validate: validateEnv });
```

도메인 특화 키(예: 외부 API, S3 자격증명 등)는 스타터에 포함하지 않는다. 도메인 단계에서 `env.schema.ts`를 확장한다.

### 주요 키 그룹 (env.schema.ts)

- **Runtime**: `NODE_ENV`, `APP_ENV`, `TZ`, `PGTZ`
- **Application**: `APP_NAME`, `APP_PORT`, `APP_URL`, `APP_CORS_URL`, `SWAGGER_ENABLED`, `LOG_LEVEL`, `RESPONSE_DEBUG_DETAIL`
- **Security/Middleware**: `TRUST_PROXY`, `HELMET_CSP_ENABLED`, `COMPRESSION_*`
- **Database**: `POSTGRES_*`, `MIKRO_ORM_CONNECTION_POOL_*`, `ORM_DEBUG`
- **Redis**: `REDIS_*`
- **Cookie/Session/Auth**: `COOKIE_*`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SESSION_*`, `AUTH_MAX_LOGIN_ATTEMPTS`, `AUTH_LOCK_DURATION_MINUTES`
- **Mail (골격)**: `MAIL_ENABLED`(기본 false), `MAIL_FROM` — 기본 비활성. 도메인 단계에서 provider 연결.
- **Storage (골격)**: `STORAGE_DRIVER`(기본 `noop`) — no-op 드라이버. `s3` 등은 도메인 단계에서 구현.
- **Observability**: `OTEL_*` (기본 비활성).

## `.env.test` (committed)

`.env.test`는 **git에 커밋한다.** 모든 값이 localhost 전용이고 비밀이 없기 때문이다.

- 통합/E2E 테스트는 도커 밖 호스트에서 실행하므로 전부 `localhost`를 가리킨다.
- **개발 DB와 다른 이름(`backend_template_test`)을 쓴다.** 통합 테스트가 매 실행마다 테이블을 truncate하기 때문이다 (`09-testing.md`의 metadata 기반 `truncateAll` 참조).
- Jest 설정(`tests/jest-integration.json`, `tests/jest-e2e.json`)은 `_utils/setup-test-env.ts`에서 `.env.test`를 로드한다.

```env
# .env.test (요약)
APP_ENV=dev
POSTGRES_DB=backend_template_test
POSTGRES_HOST=localhost
REDIS_HOST=localhost
```

## 로컬 인프라 (Docker Compose)

```bash
pnpm docker:up      # postgres + redis 기동
pnpm docker:down    # 종료
pnpm docker:clean   # 볼륨까지 정리
```

`docker-compose.yml` 구성:

- `postgres` (postgres:17.6-alpine)
- `redis` (redis:8.2-alpine)
- `pgadmin` (선택) — `docker compose --profile tools up -d`로만 기동

접속 주소(기본):

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/api/docs` (`SWAGGER_ENABLED=true`일 때)

## 스크립트 요약

| 명령                    | 설명                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| `pnpm start:dev`        | 로컬 watch 실행 (SWC + type-check)                               |
| `pnpm start:prod`       | production 런타임 실행 (dist)                                    |
| `pnpm migration:up`     | 마이그레이션 적용                                                |
| `pnpm migration:verify` | 로컬 임시 DB로 pending 마이그레이션 dry-run (`10-deployment.md`) |
| `pnpm seed`             | 시드 데이터 (개발 전용)                                          |
| `pnpm docker:up`        | 로컬 postgres + redis 기동                                       |

## 환경별 권장값 예시

### 로컬 (APP_ENV=dev)

```env
APP_ENV=dev
LOG_LEVEL=debug
ORM_DEBUG=true
RESPONSE_DEBUG_DETAIL=true
TRUST_PROXY=false
SWAGGER_ENABLED=true
```

### 프로덕션 (APP_ENV=prod)

```env
APP_ENV=prod
LOG_LEVEL=warn
SWAGGER_ENABLED=false
TRUST_PROXY=1
COOKIE_SECURE=true
```

## 동작 규칙

- `APP_ENV=dev`(로컬)에서만 자동 schema sync(`schema:update`)를 권장한다.
- `APP_ENV=stage`, `prod`에서는 마이그레이션 기반으로 동작하며, pending migration이 있으면 부팅을 거부하도록 운영한다 (`10-deployment.md`).
- `SWAGGER_ENABLED=false`이면 Swagger가 비활성화된다 (기본값: true).
- `.env` 파일은 git에 커밋하지 않는다. 민감 정보는 환경변수로만 주입한다.
