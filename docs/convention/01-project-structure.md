# 프로젝트 구조

## 기본 관점

- 이 프로젝트는 레이어 우선이 아니라 **도메인 우선**으로 코드를 배치한다.
- 비즈니스 로직은 `src/modules` 아래의 도메인 모듈에 둔다.
- 공통 유틸, 앱 인프라, 외부 인프라, 도메인 간 계약은 각각 `common`, `core`, `lib`로 분리한다.
- 새 기능을 추가할 때는 먼저 "이 기능의 소유 도메인이 어디인가"를 결정한다.
- 그다음 "다른 모듈과 동기 호출로 연결할지, 이벤트로 비동기 연결할지"를 판단한다.
- 마지막으로 해당 모듈이 이미 따르는 로컬 구조 패턴을 유지한다.

## `src/` 배치 기준

```text
src/
  main.ts                  ← 엔트리포인트
  bootstrap.ts             ← Nest 앱 초기화
  app.module.ts            ← 루트 모듈
  swagger.ts               ← Swagger 설정
  metadata.ts              ← prebuild/기동 시 자동 생성되는 Swagger 메타데이터 (gitignore, 직접 수정 금지)
  health.controller.ts     ← 헬스 체크
  tracing.ts               ← OpenTelemetry 계측 초기화
  config/
    env.schema.ts          ← zod 환경변수 검증 스키마
  common/                  ← 순수 유틸, 상수, 데코레이터
  core/                    ← 앱 전역 DI 인프라
  lib/                     ← 외부 시스템 연동 모듈
  modules/                 ← 비즈니스 도메인 (auth, identity 레퍼런스 구현)
```

> `src/modules/`에는 `auth`·`identity`(User/Team/Role)가 RBAC+ABAC 레퍼런스로 들어 있다. 새 도메인 모듈은 이 아래에 추가하며, `identity`를 본보기로 삼는다.

새 코드를 어디에 둘지 판단할 때는 아래 순서를 따른다.

1. DI 없이 import만으로 재사용 가능한가? → `common/`
2. 앱 전역에서 쓰는 가드, 인터셉터, 로거, 크론 기반인가? → `core/`
3. DB, Redis, Mail, Storage 같은 외부 인프라인가? → `lib/`
4. 특정 비즈니스 유스케이스인가? → `modules/`

## 디렉터리별 역할

### `src/common`

- `base/` — `BaseEntity`, `BaseRepository`, 공통 응답 래퍼 `R.*`
- `config/` — `runtime-env.ts` (APP_ENV 헬퍼, 환경 판별 함수)
- `constants/` — Redis 키, 이벤트 관련 상수
- `decorators/` — `Public`(인증 스킵), `IsBool`, `IsDateOrDateString`. 접근제어 데코레이터(`@Requires`, `@CurrentUser`)는 `lib/access-control`에 있다(`05-access-control.md`)
- `exceptions/` — 공통 HTTP 예외 기반 클래스
- `types/` — JSON, 공용 타입
- `utils/` — 시간, 비밀번호, 로그 마스킹 유틸
- `validator/` — 커스텀 class-validator 구현체: `IsEmailParts`, `UniqueArray`, `IsKoreanAsciiText`/`IsKoreanAsciiNoNewline`/`IsSearchKeyword`/`IsNoEmojiNoNewline` + 패턴 상수(`KOREAN_ASCII_TEXT_PATTERN` 등)

### `src/core`

- `auth/` — 전역 `AuthGuard`
- `cron/` — 크론 잡 추상 클래스
- `filters/` — 전역 예외 필터
- `interceptors/` — `FrameworkGlobalInterceptor`
- `logger/` — `FrameworkLogger`, 요청 컨텍스트(`context-storage`), ORM 로거, `CustomNamingStrategy`
- `tracing/` — OpenTelemetry 트레이싱 설정

### `src/lib`

- `access-control/` — 팀 스코프 RBAC+ABAC 엔진: `@Requires(action, resourceType)` 데코레이터, `PolicyGuard`(Tier1), `ResourcePolicy`(Tier2), `Action` enum, `GlobalRole` enum(SUPER), `AuthSubject` 타입
- `database/` — MikroORM 설정, DB 모듈, 시더, Kysely 읽기 클라이언트(`kysely/` — 복잡 조회용 `KYSELY_DB`, `10-query-strategy.md`)
- `redis/` — Redis 클라이언트
- `mail/` — 메일 발송 (현재 no-op 스켈레톤)
- `storage/` — 파일 스토리지 (현재 no-op 스켈레톤)
- `session/` — 세션 관리

### `src/modules`

비즈니스 도메인 모듈을 배치하는 최상위 디렉터리다. `auth`·`identity`(User/Team/Role)가 RBAC+ABAC 레퍼런스로 들어 있다. 새 도메인은 이 아래에 생성하며 `identity`를 본보기로 삼는다. 모듈 구조 패턴은 `03-module-patterns.md`를 참조한다.
