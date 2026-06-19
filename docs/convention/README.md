# Backend Template 컨벤션 가이드

backend-template에 합류한 개발자가 "어디에 무엇을 두고, 어떻게 연결하는가"를 빠르게 파악하기 위한 문서 모음이다. backend-template는 도메인 비종속 NestJS 11 / MikroORM v7 / PostgreSQL / Redis 스타터다.

## 문서 목록

| 문서                                                     | 설명                                                                                            |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [00-project-setup.md](00-project-setup.md)               | 기술 스택, ESLint/CI/Hook 설정, 룰 추가/제거 방법                                               |
| [01-project-structure.md](01-project-structure.md)       | 도메인 우선 관점과 `src/` 배치 기준                                                             |
| [03-module-rules.md](03-module-rules.md)                 | 모듈 분리 기준, 동기/비동기 연결 규칙                                                           |
| [04-module-patterns.md](04-module-patterns.md)           | Compact Feature / Role-Folder / Domain-Driven 모듈 구조 패턴                                    |
| [05-layer-responsibility.md](05-layer-responsibility.md) | Controller / Service / Repository / Entity 책임, MikroORM 관계 처리                             |
| [06-access-control.md](06-access-control.md)             | 팀 스코프 RBAC + 소유권 ABAC, default-deny, 3-tier (`@Requires` / PolicyGuard / ResourcePolicy) |
| [07-naming-and-style.md](07-naming-and-style.md)         | 네이밍 규칙, 구현 스타일, 새 기능 추가 체크리스트                                               |
| [08-env-setup.md](08-env-setup.md)                       | zod typed config, `.env` / `.env.test`, Docker, 스크립트                                        |
| [09-testing.md](09-testing.md)                           | 단위/통합/E2E 3-tier, metadata 기반 `truncateAll`, 테스트 인프라                                |
| [10-deployment.md](10-deployment.md)                     | 환경 구분, 마이그레이션 워크플로, Baseline 전진/squash, `migration:verify`                      |
| [11-query-strategy.md](11-query-strategy.md)             | 3경로 규칙(MikroORM/Kysely ReadModel/ReadService), Load Strategy, 인덱스 원칙                   |
| [12-api-design.md](12-api-design.md)                     | REST URL/리소스 규칙, HTTP 메서드·상태코드, JSDoc→Swagger·orval, 설계 가드레일                  |
| [13-observability.md](13-observability.md)               | 로깅(FrameworkLogger)·트레이싱(OTel)·요청 컨텍스트·전역 에러/응답 파이프라인                    |

## 추천 읽기 순서

1. 이 README로 전체 흐름을 파악한다.
2. [01-project-structure.md](01-project-structure.md)로 `src/` 디렉터리 배치 기준을 익힌다.
3. 실제 코드를 읽는다: `src/app.module.ts` → `src/lib/` (access-control, database) → `src/common/base/`.
4. 새 도메인을 만들 때 [04-module-patterns.md](04-module-patterns.md)로 패턴을 고르고, [05](05-layer-responsibility.md)/[07](07-naming-and-style.md)을 따른다.
5. 나머지 문서는 필요할 때 참고한다.

## 자동 검증 체계

| 단계        | 메커니즘                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Claude 세션 | Stop 훅(`.claude/settings.json`) → 턴 종료 시 변경 파일 일괄 prettier `--write` + eslint `--fix`                                |
| Pre-commit  | Husky → `lint-staged`(변경 파일 ESLint `--fix`) + 마이그레이션 드리프트 가드(`--warn`)                                          |
| CI          | `.github/workflows/ci.yml` → 드리프트 가드(차단) → `lint:check` → `typecheck` → `dep:check`(모듈 경계) → `build` → 3계층 테스트 |

## 한 줄 요약

backend-template는 도메인 우선 구조 위에서 동기 연결은 `imports/exports`, 비동기는 이벤트로 나누고, 각 모듈은 자신의 로컬 패턴을 유지하며 controller/service/repository/entity 책임을 분리한다. 조회는 3경로 규칙(MikroORM / Kysely ReadModel / ReadService)으로 라우팅하고, 인가는 default-deny 3-tier(`@Requires` + PolicyGuard, 소유권은 `ResourcePolicy`)로 처리한다.
