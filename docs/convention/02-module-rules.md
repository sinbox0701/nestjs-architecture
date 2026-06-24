# 모듈 연결 규칙

> backend-template는 현재 도메인 모듈이 없는 스타터 상태다. 아래 규칙과 예시는 새 모듈을 추가할 때 따라야 할 패턴을 설명한다.

## 모듈 분리 기준

하나의 도메인 폴더 안에서도 모듈을 나눠야 할 때가 있다. 아래 기준으로 판단한다.

### 분리가 필요한 신호

- 서비스가 자기 모듈의 핵심 엔티티/서비스를 하나도 사용하지 않고, 외부 도메인만 조합(orchestrate)한다.
- 한 서비스의 의존성 때문에 모듈이 불필요한 import를 많이 끌어온다.
- 의존성 방향이 컨벤션에 맞지 않는다 (예: 플랫폼 모듈 → 업무 모듈).
- 순환 참조가 발생하거나 `forwardRef`가 필요해진다.

### 분리 방법

- 같은 도메인 폴더 안에 별도 `*.module.ts`를 만든다. 파일을 물리적으로 이동할 필요는 없다.
- orchestration 서비스와 그 서비스를 사용하는 controller를 새 모듈로 옮긴다.
- 원래 모듈은 핵심 CRUD만 남긴다.
- 상위 집계 모듈에서 새 모듈을 import한다.

### 분리하지 않아도 되는 경우

- 서비스가 자기 모듈의 핵심 엔티티를 사용하면서 외부 모듈도 참조하는 경우 (일반적인 의존).
- 외부 import가 1~2개 수준으로 적은 경우.
- orchestration이 아니라 단순 조회(read)만 하는 경우.

### 예시: orchestration 분리

```text
order/
  order.module.ts              ← 주문 CRUD
  order-fulfillment.module.ts  ← 배송/결제 orchestration
  service/
    order.service.ts              ← OrderModule
    order-fulfillment.service.ts  ← OrderFulfillmentModule
  controller/
    order.controller.ts               ← OrderModule
    order.admin.controller.ts         ← OrderModule
    order-fulfillment.controller.ts   ← OrderFulfillmentModule
```

- `OrderFulfillmentService`는 `OrderModule` 엔티티를 직접 사용하지 않고 `CatalogModule`, `PaymentModule`을 조합한다.
- 분리 전에는 `OrderModule → CatalogModule` 의존이 생겨 의존 방향이 맞지 않았다.
- 분리 후 `OrderModule`은 순수 CRUD 모듈로 남고, `OrderFulfillmentModule`이 orchestrator 역할을 담당한다.

### 예시: 순환 참조 해소를 위한 양방향 분리

분리 전 순환 구조:

```text
UserModule → ProfileModule (UserService가 ProfileService 사용)
OrderModule → UserModule (OrderService가 UserService 사용)
```

분리 후:

```text
identity/user/
  user.module.ts       ← 계정 CRUD (UserDataModule만 import)
  user-admin.module.ts ← 관리자 관리 orchestration (ProfileModule import)

order/
  order.module.ts          ← 주문 CRUD (UserModule import 없음)
  order-checkout.module.ts ← 결제 orchestration (UserModule import)
```

- 양쪽 모두 orchestration 서비스를 별도 모듈로 분리하면 순환이 사라진다.

## DataModule 패턴

여러 모듈이 같은 엔티티/레포지토리를 공유해야 할 때, 엔티티 등록과 기본 레포지토리만 담은 별도 DataModule을 만든다.

```text
<domain>/
  <domain>-data.module.ts    ← 엔티티 + Repository (exports)
  <domain>.module.ts         ← DataModule import + 서브모듈 집계
```

예시:

```text
catalog/
  catalog-data.module.ts    ← Product, Category 엔티티 + Repository
  catalog.module.ts         ← CatalogDataModule import + CatalogService
```

### 사용 기준

- 외부 모듈이 엔티티 조회만 필요하면 → DataModule을 import한다.
- 외부 모듈이 서비스 로직(생성/수정/삭제)도 필요하면 → 메인 모듈을 import한다.
- DataModule은 순환 참조를 피하기 위한 패턴이다. 메인 모듈 간 직접 import가 가능하면 DataModule을 경유할 필요 없다.

> **레퍼런스 부재 안내** — 스타터에는 DataModule(`*-data.module.ts`) 구현 예시가 없다(구성상 미발생, [ReadService](04-layer-responsibility.md)와 동일). 현재 모듈이 `auth`·`identity` 둘뿐이고 엔티티를 여러 모듈이 공유하는 상황이 없어서다. 여러 모듈이 같은 엔티티를 공유하게 되는 시점에 이 패턴을 처음 적용한다.

## 동기 vs 비동기 연결 선택

orchestration 모듈이 외부 도메인 서비스를 직접 DI 받을 수 있으면 **동기 호출**(직접 메서드 호출)을 기본으로 한다. 같은 트랜잭션 안에서 실행되어야 하거나, 호출 결과를 즉시 사용해야 하는 경우 특히 그렇다.

### 이벤트(비동기 연결)로 전환하는 기준

- 호출하는 쪽 모듈이 대상 모듈을 import할 수 없는 경우 (순환 참조 방지).
- 원본 write와 후속 작업이 서로 다른 트랜잭션 경계에서 실행되어도 무방한 경우.
- 후속 작업의 실패가 원본 write를 롤백해서는 안 되는 경우.

예시: `OrderCheckoutService.placeOrder()`가 `NotificationService`를 직접 호출해 알림을 발송한다. 두 모듈 모두 동일한 트랜잭션 경계에서 실행되어야 하기 때문이다.

## 동기 연결

- 다른 도메인의 기능이 필요하면 `Module imports`와 `exports`로 연결한다.
- 필요한 provider만 export한다.
- 다른 모듈 provider를 자기 모듈에 다시 등록하지 않는다.
- 순환 참조를 피한다.

예시:

- `OrderModule`이 `CatalogModule`, `UserDataModule`을 import해서 주문에 필요한 엔티티와 서비스를 사용한다.
- `OrderFulfillmentModule`이 `PaymentModule`, `ShippingModule`을 import해서 fulfillment orchestration을 수행한다.

## 비동기 연결

- 하위 도메인이나 다른 업무 도메인에 후속 처리가 필요할 때는 이벤트를 발행한다.
- 현재 비즈니스 모듈은 주로 `EventEmitter2`를 직접 주입해서 이벤트를 발행한다.
- 소비 측은 `@OnEvent(...)` 핸들러에서 처리한다.

패턴 두 가지:

1. **여러 도메인이 공유하는 안정적인 알림 이벤트**
   - 위치: 소비하는 도메인 모듈의 `event/` 폴더 (예: `src/modules/notification/event/`)
   - 발행하는 쪽은 소비 도메인의 event 파일을 import해서 emit한다.

2. **특정 생산자/소비자 쌍에 묶인 로컬 이벤트**
   - 소비자: `<domain>/handler/<event-name>.handler.ts`

### 규칙

- 원본 유스케이스의 핵심 write는 서비스에서 끝낸다.
- 알림, 파생 동기화, SSE push 같은 후속 작업은 `handler/`로 분리한다.
- 이벤트 payload는 소비하는 도메인의 `event/` 폴더에 둔다.
- 일회성 내부 통합 이벤트는 과하게 공용화하지 않아도 된다.

### 레퍼런스 구현 (identity)

`UserService.createUser`가 핵심 write 후 `UserCreatedEvent`를 발행하고, `UserCreatedHandler`가 후속 처리하는 최소 예시가 들어 있다. 새 비동기 연결은 이걸 본뜬다.

| 요소            | 파일                                        | 핵심                                                                        |
| --------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| 이벤트명 상수   | `identity/event/identity-event.constant.ts` | 매직 스트링 금지. `<도메인>.<엔티티>.<과거형>` 네임스페이스                 |
| 이벤트 페이로드 | `identity/event/user-created.event.ts`      | 식별자만(엔티티 참조 금지 — 핸들러는 별도 EM 컨텍스트)                      |
| 발행            | `identity/service/user.service.ts`          | `eventEmitter.emit(...)`. **핵심 write/커밋 후** 발행                       |
| 핸들러          | `identity/handler/user-created.handler.ts`  | `@OnEvent(name, { async: true })` + **`RequestContext.create(em, …)`** 필수 |

- **`{ async: true }`**: 발행자 요청/트랜잭션과 분리 실행 → 후속 작업 실패가 원본 write를 롤백하지 않는다.
- **`RequestContext.create(orm.em, …)`**: 비동기 핸들러는 요청 EM 컨텍스트 밖이므로 새 EM fork를 열어야 안전하게 DB 작업이 된다(없으면 글로벌 컨텍스트 경고/에러).
- 핸들러는 등록만 하면 동작한다 — `IdentityModule` providers에 핸들러 클래스를 추가한다(`EventEmitterModule`은 전역 배선됨).

## 모듈 경계 자동 강제 (`dep:check` / dependency-cruiser)

위 규칙들(레이어 방향, 도메인 간 직접 import 금지, 순환 금지)은 사람 리뷰가 아니라 **의존 그래프 fitness function으로 기계 강제**된다. ESLint(문법)가 못 잡는 "A 도메인이 B 도메인의 repository를 직접 import" 같은 경계 침식을 잡는다.

- 실행: **`pnpm dep:check`** (`.dependency-cruiser.cjs`). 로컬에서 수동 실행 가능하고, **CI에서 `build` 앞 단계로 차단**한다(`error` 룰 위반 시 PR 실패).
- 레이어 의존 방향(위→아래만 허용): `modules → lib → core → common`. (예외: `core → lib`는 현행 허용 — `AuthGuard`가 `lib/access-control` 사용)

| 룰                          | severity | 의미                                                                                                                            |
| --------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `no-circular`               | error    | 순환 의존 금지. 공통부를 아래 레이어로 내리거나 이벤트로 분리                                                                   |
| `no-common-to-modules`      | error    | `common`(순수 유틸)은 `modules`(도메인)를 알면 안 됨                                                                            |
| `no-core-to-modules`        | error    | `core`(앱 전역 인프라)는 특정 도메인에 의존 금지                                                                                |
| `no-lib-to-modules`         | error    | `lib`(외부 인프라)은 도메인에 의존 금지                                                                                         |
| `no-cross-module-internals` | error    | 다른 도메인의 `*.repository.ts`/`*.entity.ts` 직접 import 금지. 도메인 간 읽기는 ReadService, 쓰기 연계는 이벤트 (`04`/`10`)    |
| `no-cross-module-services`  | error    | 다른 도메인의 `*.service.ts` 직접 import 금지(읽기 전용 `*-read.service.ts`만 예외). 도메인 간 읽기는 ReadService만 (`04`/`10`) |
| `no-common-to-app-layers`   | warn     | `common → core/lib` 결합은 표면화만(현재 로거/타입 일부 결합). 새 코드에서 늘리지 말 것                                         |

> PR이 `dep:check`에서 막히면 위 표에서 어떤 경계를 넘었는지 확인한다. 이 fitness function이 `01-project-structure.md`(레이어 배치)와 이 문서(모듈 경계)를 _실제로_ 집행하는 장치다.
