# 관측성과 전역 요청 파이프라인

로깅·트레이싱·요청 컨텍스트·전역 에러/응답 처리를 다룬다. 이 인프라는 `src/core/`(logger/tracing/filters/interceptors) + `src/tracing.ts`에 있으며, 도메인 코드는 보통 `FrameworkLogger`만 직접 쓰고 나머지는 자동 적용된다.

## AI Quick Reference

- **로깅**: `console.*` 금지, `FrameworkLogger`(`src/core/logger/`) 사용. 로그에 추적 식별자(id 등) 포함. 모든 로그 줄에 `[caller:line][traceId]`가 자동 prefix됨.
- **trace 상관관계**: 활성 OTel `traceId`(없으면 ALS `x-trace-id`)가 로그 prefix와 응답 헤더 `x-trace-id`에 동일하게 박힌다 → 로그·트레이스·클라이언트가 한 id로 연결.
- **트레이싱**: OTel은 **trace 전용**, `OTEL_ENABLED=true` + endpoint 있을 때만 활성. `src/tracing.ts`는 `main.ts`에서 **CJS `require` 순서**로 로드(절대 `import`로 바꾸지 말 것).
- **전역 인터셉터**(`FrameworkGlobalInterceptor`, APP_INTERCEPTOR): 요청마다 ALS 컨텍스트 생성 + `x-trace-id` 전파 + 요청/바디 디버그 로그(sanitized) + 응답 헤더 세팅. SSE(`text/event-stream`)는 패스.
- **전역 에러 필터**(`HttpExceptionFilter`, `bootstrap.ts`에서 `useGlobalFilters`): 모든 예외를 통일 응답으로. 민감값은 `LogSanitizer`로 마스킹. 상세 디버그는 `RESPONSE_DEBUG_DETAIL=true`일 때만 노출.
- 관련 env: `OTEL_*`, `LOG_LEVEL`(debug|info|warn|error), `RESPONSE_DEBUG_DETAIL`.

## 로깅 — `FrameworkLogger`

`src/core/logger/framework-logger.ts`. NestJS `ConsoleLogger`를 확장한다.

- **레벨**: `LOG_LEVEL` env(`debug|info|warn|error`)를 NestJS 레벨로 매핑(`info`→`log`). 해당 레벨 이상만 출력.
- **포맷**: 모든 출력에 `[functionName:lineNumber][traceSign] message`를 prepend한다. caller는 스택 트레이스에서, `traceSign`은 `ContextStorage.getCurrnetContextSign()`(OTel traceId 우선)에서 가져온다.
- **사용**: 쓰기/orchestration 서비스·핸들러에 인스턴스를 둔다. 추적 식별자(`orderId`, `userId` 등)를 메시지에 포함한다(`07-naming-and-style.md`). 민감값은 `LogSanitizer`(`src/common/utils/log-sanitizer.ts`) 기준을 따른다.
- **ORM 로그**: `OrmLogger`(`src/core/logger/orm-logger.ts`)가 MikroORM 쿼리 로그를 레벨별로 Nest Logger에 위임한다.

## 요청 컨텍스트 — `ContextStorage`

`src/core/logger/context-storage.ts`. `AsyncLocalStorage` 기반 요청 스코프 저장소.

- 키: `x-trace-id`(서명), `x-framework-name`(호출 출처).
- `getCurrnetContextSign()`: **활성 OTel traceId를 우선** 반환, 없으면 ALS에 저장된 `x-trace-id`, 그것도 없으면 `'NONE'`. → 로그와 응답 헤더가 트레이스와 같은 id로 정렬된다.
- 컨텍스트 생성/전파는 전역 인터셉터가 요청 시작 시 수행한다.

## 트레이싱 — OpenTelemetry (`src/tracing.ts`)

- **trace 전용** NodeSDK. `OTEL_ENABLED=true`이고 `OTEL_EXPORTER_OTLP_ENDPOINT`가 있을 때만 초기화(아니면 비활성 + 안내 로그).
- 자동 계측: http / express / nestjs-core / pg / redis (fs·dns·net은 비활성).
- **로딩 순서가 핵심**: `main.ts`는 `require('reflect-metadata')` → `require('./tracing')` → `import('./bootstrap')` 순서다. `src/tracing.ts`를 `import './tracing'`로 바꾸면 SWC가 ES import를 CJS 최상단으로 hoist해 `reflect-metadata` 위로 올라가 **데코레이터 메타데이터가 깨진다**. CJS `require()`가 명시적 순서를 보존한다.
- `getTraceContext()`: 활성 trace/span id 반환(없으면 null). 로거·컨텍스트가 사용.
- **종료**: `OtelShutdownService`(`BeforeApplicationShutdown`)가 HTTP 서버가 연결을 끊기 전에 SDK를 flush/shutdown(5초 타임아웃). `bootstrap.ts`의 `app.enableShutdownHooks()`에 의존.
- 확장: metrics/logs 브리지가 필요하면 exporter를 추가하고 종료 로직에 flush를 더한다.

## 전역 인터셉터 — `FrameworkGlobalInterceptor`

`src/core/interceptors/framework-global.interceptor.ts`. `APP_INTERCEPTOR`로 등록(`app.module.ts`).

요청마다(http, SSE 제외):

1. `x-trace-id` 서명을 생성/전파하고 `AsyncLocalStorage.run()`으로 요청 컨텍스트를 연다.
2. `[METHOD] url`, `[BODY]`(LogSanitizer로 마스킹), 호출 출처를 debug 로그.
3. 응답 헤더에 `x-trace-id`, `x-framework-name`을 세팅.

→ 이후 모든 로그가 같은 trace 서명을 달고, 클라이언트는 응답 헤더로 그 id를 받는다.

## 전역 에러/응답 — `HttpExceptionFilter`

`src/core/filters/http-exception.filter.ts`. `bootstrap.ts`에서 `app.useGlobalFilters(new HttpExceptionFilter(configService))`로 등록. `NestHttpException`과 일반 `Error`를 모두 잡는다.

- 응답을 **통일된 에러 형태**로 만든다(`src/common/exceptions`의 `HttpException` 래퍼 경유). 출력은 항상 `LogSanitizer.sanitize()`를 거친다.
- **상세 디버그**(stack/body/path 등)는 `RESPONSE_DEBUG_DETAIL=true`일 때만 응답에 포함. 운영에선 끈다.
- 처리되지 않은 `Error`는 500 + `Internal server error`로 정규화하고, 내부적으로 stack을 로깅한다.
- 도메인 코드는 인라인 예외 대신 `exception/` 팩토리 상수를 던진다(`05-layer-responsibility.md`, CLAUDE.md #3). 필터가 그 형태를 그대로 직렬화한다.

## 관련 환경 변수

| 키                                               | 용도                                                       |
| ------------------------------------------------ | ---------------------------------------------------------- |
| `OTEL_ENABLED`                                   | OTel SDK 활성(기본 false). endpoint와 함께 있어야 동작     |
| `OTEL_EXPORTER_OTLP_ENDPOINT` / `_PROTOCOL`      | OTLP collector 주소/프로토콜                               |
| `OTEL_SERVICE_NAME` / `OTEL_RESOURCE_ATTRIBUTES` | service.name 및 추가 리소스 속성                           |
| `LOG_LEVEL`                                      | `debug`/`info`/`warn`/`error` (info는 Nest `log`으로 매핑) |
| `RESPONSE_DEBUG_DETAIL`                          | 에러 응답에 stack/body 등 상세 포함(운영 false)            |
