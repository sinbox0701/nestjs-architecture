# Tech Debt / 추후 작업

backend-template 아키텍처 리뷰(2026-06-18)에서 **의도적으로 미뤘거나 골격만 남긴 항목**을 기록한다.
"지금 안 한 것"을 잊지 않기 위한 목록이며, 각 항목은 _언제(트리거)_ 처리해야 하는지를 함께 적는다.

> 원칙: 조기 플러밍을 깔지 않는다. 아래 항목 대부분은 "필요해지는 시점"이 명확하므로
> 그 트리거가 오기 전까지는 의도적으로 비워둔다.

## 우선순위 요약

| #   | 항목                                | 분류          | 트리거 (언제)                                     | 상태          |
| --- | ----------------------------------- | ------------- | ------------------------------------------------- | ------------- |
| 1   | Guard non-HTTP 우회 (WS 인증)       | 보안          | WebSocket/마이크로서비스 도입 시                  | 미착수        |
| 2   | Throttler·Cache Redis 백킹          | 확장성        | 인스턴스 2대 이상 배포 시                         | 미착수        |
| 3   | 트랜잭셔널 아웃박스                 | 확장성/정합성 | 크로스 인스턴스 이벤트 or 이벤트 유실 불가 도메인 | 미착수        |
| 4   | `common → core/lib` 결합 제거       | 구조          | 점진 (새 코드에서 증가 금지)                      | warn 표면화됨 |
| 5   | ResourcePolicy / ABAC Tier 2 베이스 | 기능          | 리소스 소유권 기반 인가가 필요한 첫 도메인        | 미착수        |
| 6   | State Machine Entity 베이스         | 기능          | 상태 전이가 핵심인 첫 도메인                      | 미착수        |
| 7   | 메트릭(Prometheus)                  | 관측성        | 부하/SLO 관리 시작 시                             | 미착수        |
| 8   | 아키텍처 문서 ↔ 스타터 간극 동기화  | 문서          | 상시                                              | 부분          |

---

## 1. Guard가 non-HTTP 컨텍스트를 무조건 통과 (보안)

**현재 상태.** [auth.guard.ts](../../src/core/auth/auth.guard.ts)·[roles.guard.ts](../../src/lib/access-control/roles.guard.ts) 둘 다 `context.getType() !== 'http'`이면 `return true`. 지금은 HTTP 전용이라 무해하다.

**리스크.** 목표 아키텍처는 WebSocket Gateway(대회/훈련 양방향)를 포함한다. WS(또는 RPC/마이크로서비스) 트랜스포트를 도입하는 순간 인증·인가가 **통째로 우회**된다.

**해결 방향.**

- WS 도입 시 WS 전용 인증 가드(handshake 토큰 검증)를 별도로 배선한다.
- 그 전까지는 컨벤션 문서(`06-access-control.md`)에 "WS auth는 HTTP 가드와 별개로 명시 처리 필수"를 박아 둔다.

**트리거.** WebSocket/마이크로서비스 트랜스포트 도입 PR.

---

## 2. Throttler·Cache가 인메모리 (확장성)

**현재 상태.** [app.module.ts](../../src/app.module.ts)의 `ThrottlerModule.forRoot()`·`CacheModule.register()`가 기본 **인메모리** 스토리지다.

**리스크.** 인스턴스가 2대 이상이면:

- rate-limit 카운터가 인스턴스마다 분리 → 실질 제한이 (인스턴스 수)배로 느슨해짐.
- 캐시가 인스턴스별로 갈려 hit율 저하 + 무효화 불일치.

목표 아키텍처(동시접속 5,000, 멀티 인스턴스)와 충돌한다.

**해결 방향.**

- Throttler: `@nest-lab/throttler-storage-redis` 등 Redis 스토리지로 교체.
- Cache: `@nestjs/cache-manager` + `keyv`/`cache-manager-redis` Redis 백킹.
- 기존 `RedisClient` 커넥션 재사용을 우선 검토(이중 풀 회피).

**트리거.** 인스턴스 2대 이상으로 가는 첫 배포 구성.

---

## 3. 트랜잭셔널 아웃박스 부재 (확장성 / 정합성)

**현재 상태.** 도메인 이벤트는 `EventEmitter2`뿐(in-process). 컨벤션은 "트랜잭션 커밋 후 emit"을 강제한다([05-layer-responsibility.md](../convention/05-layer-responsibility.md)).

**리스크.**

- **유실(dual-write).** 커밋 성공 → emit 직전 프로세스 크래시 = 이벤트 영구 유실.
- **전파 불가.** in-process 이벤트는 다른 인스턴스로 전파되지 않는다.

목표 아키텍처가 언급한 Redis Streams(integration event)의 seam이 스타터에 없다.

**해결 방향.**

- 도메인 비종속 **outbox 테이블 + relay(폴링/CDC)** 골격 추가. 같은 트랜잭션에서 outbox에 기록 → 별도 relay가 발행 → at-least-once 보장.
- 발행 채널은 Redis Streams 또는 메시지 브로커. 소비자 멱등 처리 전제.

**트리거.** (a) 크로스 인스턴스 이벤트가 필요해질 때, 또는 (b) 유실이 허용 안 되는 도메인 이벤트(결제/점수 등)가 처음 생길 때.

---

## 4. `common → core/lib` 결합 (구조)

**현재 상태.** dependency-cruiser가 warn으로 표면화 중(2건):

- [express-request.d.ts](../../src/common/types/express-request.d.ts) → `@/lib/access-control` (AuthSubject 타입)
- [is-date-or-date-string.decorator.ts](../../src/common/decorators/is-date-or-date-string.decorator.ts) → `@/core/logger` (FrameworkLogger)

`common`은 "DI 없이 import만으로 재사용되는 순수 레이어"가 이상이므로 위 결합은 작은 냄새다.

**해결 방향.** 점진. AuthSubject 같은 도메인 간 계약 타입의 소속(common vs lib)을 재정리하고, 검증 데코레이터의 로거 의존을 제거(또는 주입)한다. **새 코드에서 `common → core/lib`를 늘리지 않는 것**이 우선.

**트리거.** 상시(리뷰에서 신규 위반 차단), 여유 시 기존 2건 해소.

---

## 5. ResourcePolicy / ABAC Tier 2 베이스 (기능)

**현재 상태.** 인가는 flat RBAC(USER/ADMIN/SUPER, `@Roles` + RolesGuard)만. 목표 아키텍처의 2-tier 중 **Tier 2(리소스 소유권 기반 Policy)**가 없다. 정수 autoincrement PK([base.entity.ts](../../src/common/base/base.entity.ts)) + flat RBAC 조합은 Policy 레이어 도착 전까지 IDOR 표면이 넓다.

**해결 방향.** 도메인 비종속 `ResourcePolicy` 추상 베이스(`canRead/canUpdate/...` + 멤버십/소유권 헬퍼)를 골격으로 제공. 실제 정책은 도메인에서 구현.

**트리거.** "본인/팀 소유 리소스만 접근" 류 인가가 필요한 첫 도메인.

---

## 6. State Machine Entity 베이스 (기능)

**현재 상태.** 없음. 목표 아키텍처는 상태 전이가 핵심인 도메인(훈련/대회)에 transition map 패턴을 제시.

**해결 방향.** 전이 테이블 + `canTransition()/transition()`을 가진 도메인 비종속 베이스(또는 믹스인)를 제공. 전이 위반은 예외 팩토리로.

**트리거.** 상태 전이가 핵심인 첫 도메인.

---

## 7. 메트릭(Prometheus) 부재 (관측성)

**현재 상태.** OpenTelemetry **트레이싱**은 있으나([tracing.ts](../../src/tracing.ts)) 메트릭이 없다.

**리스크.** 5,000 동접 규모에서 RED(Rate/Error/Duration)·USE 지표 없이 운영하면 회귀/포화를 사후에만 안다.

**해결 방향.** OTel metrics 또는 `prom-client` 기반 `/metrics` 노출. 핵심 지표(요청 지연, 에러율, DB/Redis 풀 사용률).

**트리거.** 부하 테스트 시작 또는 SLO 정의 시점.

---

## 8. 아키텍처 문서 ↔ 스타터 간극 (문서)

**현재 상태.** Notion "Better than Backend Architecture"가 약속한 것 중 스타터에 **아직 없는 것**: Kysely 배선(첫 사용 시 추가 — 의도된 지연), WebSocket, Redis Streams, 2-instance Redis, ABAC Policy, Leaderboard(Sorted Set), State Machine. 신규 합류자가 "문서엔 있는데 코드엔 없다"로 혼동할 수 있다.

또한 Notion 문서는 Kysely **전용 풀(max:5)**을 그렸으나, 스타터([11-query-strategy.md](../convention/11-query-strategy.md))는 **MikroORM 풀 재사용**으로 정정했다(더 나은 결정). 두 문서가 어긋나 있다.

**해결 방향.**

- 스타터 README 또는 본 문서에 "어디까지 골격 / 어디부터 도메인 단계" 체크리스트를 명시.
- Notion 아키텍처 문서의 Kysely 풀 항목을 "MikroORM 풀 재사용"으로 동기화.

**트리거.** 상시(문서 변경 시 함께 갱신).

---

## 설계 노트 (부채는 아니지만 기억할 것)

- **FK 제약**은 DB 레벨로 켜져 있다(`createForeignKeyConstraints: true`). 테스트 teardown은 `truncateAll`의 `TRUNCATE ... CASCADE`가 FK 의존 행까지 정리하므로 순서 의존이 없다. 참조: [mikro-orm.config.ts](../../src/lib/database/mikro-orm.config.ts).
- **`RedisClient.keys()`는 SCAN 기반**이지만 비스냅샷이다(순회 중 추가/삭제 키 누락·중복 가능). 정확 집합·잦은 대량 매칭이 필요하면 패턴 스캔 대신 **Set/Hash 인덱스로 설계**한다. 참조: [redis.client.ts](../../src/lib/redis/redis.client.ts).
- **env 안전성 게이트**는 prod/stage에서 시크릿·쿠키·trust-proxy만 강제한다. Swagger 노출은 운영 정책 선택이라 의도적으로 강제하지 않음. 참조: [env.schema.ts](../../src/config/env.schema.ts).
