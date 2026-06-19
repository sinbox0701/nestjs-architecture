# 네이밍과 구현 규칙

## AI Quick Reference

- **프론트 계약 영향**: DTO 클래스명 / controller method명 / DTO 필드 타입은 orval로 프론트 TS 타입/함수명에 **직결**. 리네이밍 = 프론트 breaking change
- **DTO 파일 스타일**: 행위별 bundled `.dto.ts` (Request + Response를 한 파일에). `.request.ts`/`.response.ts` 분리 금지
- **DTO 클래스명**: `행위 + 대상 + Request/Response` (예: `CreateOrderRequest`). 중첩 응답은 `대상 + Data` (예: `OrderData`)
- **DON'T**: `CreateRequest`, `ListResponse`, `UserDto` 같은 전역에서 의미 약한 이름
- **메서드명**: `getBy...`(없으면 예외) vs `findBy...`(없으면 null/빈배열). `find...With...`(로딩 의도 표현)
- **Controller method명**: path scope 안에서 행위만 표현. `create`, `getList`, `getDetail` (도메인명 반복 금지)
- **Enum 강제**: DTO 필드는 bare union(`'a' \| 'b'`) 대신 `enum`을 쓴다. 안 그러면 orval이 `unknown`으로 뽑는다
- **메서드 순서**: Create → Read → Update → Delete
- **응답**: `R.data`, `R.list`, `R.page`, `R.cursorPage`, `R.empty`
- **import**: 외부 패키지 → `@/...` alias → 상대 경로. 모듈 경계 넘는 참조는 `@/` 사용
- **DTO Swagger**: `@ApiProperty()` 지양. controller에서 JSDoc으로 `@ApiOperation()` 대체
- **DTO nullable**: 값이 없을 수 있는 필드는 `?:` optional로 선언. 값이 없으면 응답에서 키를 노출하지 않는다. `| null` 유니온은 절대 쓰지 않는다 (`!: T | null`, `?: T | null` 모두 금지)
- **private → helper 분리**: DI 없는 순수 함수 + 여러 곳 재사용일 때만. 그 외는 `private` 메서드

---

## 프론트엔드 계약 영향 (orval)

프론트엔드는 백엔드 Swagger spec을 [orval](https://orval.dev/)로 코드젠하여 TS 타입/API 함수를 만든다. 아래 세 가지는 **그대로 프론트 코드에 박히는 계약**이므로, 수정 시 프론트 breaking change가 발생한다는 점을 항상 의식한다.

> orval FE 코드젠 사용 여부는 프로젝트마다 다를 수 있다. 해당 섹션은 orval을 사용하는 프론트엔드 프로젝트와 연동할 때의 규칙이다.

### 1. DTO 클래스명 → 프론트 TypeScript 타입명

- `class CreateOrderRequest` → 프론트 `type CreateOrderRequest`
- **변경 금지**: 이미 프론트가 import해서 쓰고 있는 이름. 리네이밍은 프론트 코드 수정과 동기화 필수
- **대소문자 그대로**: orval은 DTO 클래스명을 변환 없이 쓴다. `userDto` 같은 잘못된 casing도 그대로 전파되므로 처음부터 PascalCase 정확히

### 2. Controller method명 → 프론트 API 함수명

- `@Controller('/orders') class OrderController { getList() {} }` → 프론트 `orderControllerGetList()` 류 함수명
- 도메인명을 반복하면 프론트에서 `orderControllerGetOrderList()` 처럼 중복 네이밍이 된다 → `getList()`처럼 짧게
- `operationId`를 별도 지정하지 않으므로 controller class명 + method명이 그대로 사용된다

### 3. DTO 필드 타입 → orval 생성 타입

정적으로 추론 가능한 타입을 써야 orval이 제대로 된 타입을 만든다. 아래 패턴들은 orval에서 `{ [key: string]: unknown }` 또는 `unknown`으로 떨어진다.

```typescript
// DON'T: bare string union — Swagger plugin이 런타임 타입을 모름
export type BuildStatus = 'pending' | 'completed' | 'failed'; // ❌
class StatusData {
  status!: BuildStatus; // orval: { [key: string]: unknown }
  type!: 'draft' | 'published'; // ❌ 인라인 union도 동일
}

// DO: string enum — orval이 union 타입으로 정확히 생성
export enum BuildStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}
class StatusData {
  status!: BuildStatus; // orval: type BuildStatus = 'pending' | 'completed' | 'failed'
}
```

- **bare `type X = 'a' | 'b'` 금지**: 런타임에 존재하지 않아 `@nestjs/swagger` readonly visitor가 타입 정보를 뽑을 수 없다
- **`enum X | 'extra'` 같은 enum+literal union도 금지**: 동일하게 orval `unknown`으로 전파. 필요한 값을 모두 포함한 단일 enum으로 만든다
- **단일 literal은 허용**: `status!: 'none'`처럼 값이 하나뿐인 literal은 orval에서 `string`으로 떨어져 사용 가능. 단 의미가 확장될 것 같으면 처음부터 enum
- **`Partial<Record<K, V>>` 같은 복합 제네릭도 위험**: orval `unknown`. 명시적인 nested DTO 클래스로 푼다

### 영향 파급 최소화 팁

- DTO/controller method 리네이밍이 필요하면 프론트와 동시에 PR을 맞춘다
- DTO 필드 타입을 bare union → enum으로 바꾸는 건 프론트 입장에선 `unknown` → 구체 타입이 되는 것이므로 보통 문제 없음 (단, 기존에 `unknown`으로 넘기던 값 비교 로직이 있다면 주의)

---

## 파일명과 클래스명

- 파일명은 보통 `도메인명 + 역할` 조합을 쓴다.
- 예: `order.service.ts`, `note.repository.ts`, `order.admin.controller.ts`
- 역할 폴더 안에서도 파일명은 도메인명을 포함한다.
- API에 노출되는 DTO 클래스명은 전역 고유성이 중요하므로, 파일 지역 문맥에 기대지 않고 이름만 보고도 endpoint 목적이 드러나야 한다.
- request/response DTO 클래스명은 `행위 + 대상 + Request/Response`를 기본으로 하고, nested 응답 타입은 `대상 + Data/...Data` 규칙을 따른다.
- controller/service/repository 클래스명은 도메인명을 포함해도 되지만, controller의 public method명에는 같은 도메인명을 반복하지 않는다.

## 메서드명

- `getBy...` — 없으면 예외를 던지는 조회
- `findBy...` — 없으면 `null` 또는 빈 배열 반환 가능
- `find...With...` — 어떤 관계를 로딩하는지 이름에 드러냄

### controller method명

- controller method명은 OpenAPI client 생성 시 외부 계약의 일부로 취급한다. 현재 프로젝트는 별도 `operationIdFactory`를 두지 않으므로, controller method명은 안정적이고 짧아야 한다.
- controller method명은 "controller path 안에서의 행위"를 표현한다. 루트 도메인/엔티티 이름을 반복하지 않는다.
  - 권장: `create`, `getList`, `getDetail`, `update`, `delete`, `deleteList`
  - 비권장: `createOrder`, `getOrderList`, `updateOrder` in `OrderAdminController`
- sub-resource가 있거나 같은 controller 안에 여러 액션이 공존하면, 루트 엔티티명이 아니라 하위 행위나 route 의미를 붙인다.
  - 예: `addComment`, `updateComment`, `deleteComment`, `validateToken`, `requestPasswordReset`
- qualifier가 필요하면 도메인명이 아니라 API 의미를 붙인다.
  - 예: `getMine`, `getMyList`, `getSummary`, `getStats`, `acceptInvitation`
- 서비스/리포지토리 메서드는 도메인명이 들어가도 괜찮지만, controller는 HTTP resource scope가 이미 드러나므로 중복 명명을 피한다.
- 즉 DTO 이름은 더 구체적으로, controller method명은 더 추상적으로 가져간다.

### service method명

- service method명은 **`행위 + 대상`(유스케이스 동사)**으로 짓는다. controller와 달리 도메인명을 포함한다(다른 서비스에서 호출될 때 의미가 드러나야 함).
  - 권장: `createOrder`, `getOrder`(없으면 예외), `getOrderList`, `updateOrder`, `deleteOrder`, `restoreOrder`, `changeOrderStatus`
- 조회는 repository와 같은 `getBy`(없으면 예외) / `findBy`(없으면 null) 규칙을 따른다. service의 단건 조회는 보통 존재를 보장하므로 `getOrder`(예외 던짐)가 기본이다.
- 상태 변경은 동사를 분명히 한다: `changeStatus`, `cancel`, `approve`, `publish`. 두루뭉술한 `process`/`handle`은 피한다.

### 레이어별 메서드명 요약

| 레이어     | 규칙                                                    | 예                                                                         |
| ---------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| Controller | path scope 안 행위만, 도메인명 반복 X                   | `create`, `getList`, `getDetail`, `update`, `delete`                       |
| Service    | `행위 + 대상`(유스케이스 동사), 도메인명 포함           | `createOrder`, `getOrder`(예외), `getOrderList`, `changeOrderStatus`       |
| Repository | `getBy`(예외)/`findBy`(null)/`find...With...`(로딩의도) | `getById`, `findById`, `findByIdWithItems`, `findPage`, `findPageByCursor` |

## 메서드 순서

- `Create` or `Post` → `Read` or `Get` → `Patch` or `Update` → `Delete` 순서로 메서드를 작성한다.

## 응답 포맷

- 기본 응답 래퍼는 `src/common/base/response`의 `R.*`를 사용한다.
- 페이지네이션 응답은 `R.page`, 커서 기반 응답은 `R.cursorPage`를 사용한다.
- 새 API도 가능하면 같은 envelope을 유지한다.

## 로깅

- 쓰기 작업이나 orchestration이 있는 서비스/핸들러는 `FrameworkLogger`를 둔다.
- 로그에는 `id`, `orderId`, `userId`처럼 추적 가능한 식별자를 포함한다.
- 민감한 값은 `common/utils/log-sanitizer.ts` 규칙을 염두에 둔다.

## DTO nullable 필드 규칙

- Request/Response DTO 모두, 값이 없을 수 있는 필드는 `?:` optional로 선언한다.
- 값이 없으면 응답에서 키를 노출하지 않는다.
- `| null` 유니온은 사용하지 않는다. `!: type | null`, `?: type | null` 모두 금지.
- 서비스에서 세팅할 때도 `value ?? null` 같은 null fallback 대신 `if (조건) data.field = value` 형태로 키 자체를 빼는 방식으로 처리한다.

```typescript
// DON'T: | null 패턴
export class OrderDetailData {
  buyerEmail!: string | null; // ❌
  couponCode?: string | null; // ❌ optional + null union도 금지
}

// DO: optional로 선언
export class OrderDetailData {
  buyerEmail?: string; // ✅ 값이 없으면 키 자체를 노출하지 않음
  couponCode?: string; // ✅
}
```

## 검증과 Swagger

- DTO에서는 `class-validator`, `class-transformer`를 사용한다.
- 숫자/배열 변환을 controller에서 수동 처리하지 않는다.
- DTO는 `@ApiProperty()` 사용을 지양한다.
- controller는 JSDoc으로 `@ApiOperation()`을 대체한다.
- `@Post()` 핸들러에 `@ApiDataResponse`를 사용할 때는 status `201`을 명시한다.
  - `@ApiDataResponse(SomeData, 201)` — NestJS `@Post()`의 기본 상태 코드가 201이므로 Swagger 문서와 일치시킨다.
  - `@ApiDataResponse(SomeData)` — `@Get()`, `@Put()`, `@Patch()` 등은 기본값 200 그대로 사용한다.

## 정렬 타입 규칙

- `SortOrder`는 `common/base/sort-order.enum.ts`에 정의된 공통 enum을 사용한다. 인라인 `'ASC' | 'DESC'`를 쓰지 않는다.
- `SortBy`는 각 모듈의 `type/` 폴더에 도메인별 enum으로 정의한다. (예: `OrderSortBy`, `NoteSortBy`)
- DTO, Service, Repository 모든 레이어에서 동일하게 enum 타입을 사용한다.

## Query DTO 베이스 (필터/검색/페이지네이션)

반복되는 list 쿼리 파라미터(페이지네이션·검색)는 매번 새로 선언하지 않고 **`src/common/base/dto/`의 베이스 DTO를 `IntersectionType`으로 조합**한다. Response의 `R.*`에 대응하는 Request 쪽 표준 surface다.

| 베이스            | 필드                                            | 짝(Response/Repo)                        |
| ----------------- | ----------------------------------------------- | ---------------------------------------- |
| `OffsetPageQuery` | `pageNum`, `pageSize` + `offset`/`limit` getter | `R.page` / `repo.findPage`               |
| `CursorPageQuery` | `cursor?`, `pageSize`                           | `R.cursorPage` / `repo.findPageByCursor` |
| `KeywordQuery`    | `q?`                                            | —                                        |

```typescript
import { IntersectionType } from '@nestjs/swagger';
import { OffsetPageQuery, KeywordQuery } from '@/common/base/dto';

// 도메인 특화 필터/정렬만 추가로 선언한다 (sortBy는 도메인 enum이라 베이스에 없음)
export class GetOrderListRequest extends IntersectionType(OffsetPageQuery, KeywordQuery) {
  sortBy?: OrderSortBy;
  sortOrder: SortOrder = SortOrder.DESC;
  status?: OrderStatus; // 도메인 필터
}
```

- 쿼리스트링→숫자/불리언 변환은 전역 `ValidationPipe`(`enableImplicitConversion`)가 처리하므로 `@Type`을 controller에서 수동으로 붙이지 않는다.
- 오프셋 vs 커서 선택 기준은 `11-query-strategy.md` 참조(임의 페이지 점프 필요 → offset, 무한 스크롤/대용량 → cursor).
- 베이스 DTO 자체는 endpoint에 직접 노출하지 않으므로 `행위+대상` 네이밍 규칙의 예외다(조합용 mixin).

## 접근 제어

- 접근 제어는 `src/lib/access-control/`의 `@Requires(action, resourceType)` 데코레이터와 `PolicyGuard`(Tier1), `ResourcePolicy`(Tier2)를 사용한다.
- 액션은 `Action` enum(`create` / `read` / `update` / `delete` / `manage`)으로 정의하며, 도메인 특화 액션은 `ActionLike`(문자열)로 확장한다.
- 전역 역할은 `GlobalRole` enum(`SUPER`)을 사용한다. 팀 내 직위는 도메인에서 문자열(`TeamMembership.role`)로 정의한다.
- 상세 규칙은 `06-access-control.md`를 참조한다.

## import 규칙

- 보통 순서는 `외부 패키지 → '@/...' alias → 같은 모듈 내부 상대 경로`다.
- 모듈 경계를 넘는 참조는 `@/` alias를 사용한다.
- 같은 모듈 내부는 상대 경로를 사용한다.

## `private` 메서드 vs helper 분리 기준

- 기본값은 서비스 내부 `private` 메서드다.
- 해당 서비스의 유스케이스 흐름 안에서만 의미가 있는 로직이면 같은 파일 안에 둔다.
- DI 없이 동작하는 순수 함수이고 여러 곳에서 재사용되면 `helper` 또는 `utils`로 분리한다.
- 비즈니스 규칙 자체가 하나의 책임으로 보이거나 repository, logger, config, 외부 API 같은 의존성이 필요하면 `helper.ts`보다 별도 provider로 분리한다.
- `helper.ts`가 커지기 시작하면 단순 유틸이 아니라 별도 `Service`, `Policy`, `Factory` 후보인지 먼저 본다.
- 파일 길이만 줄이기 위해 서비스 내부 문맥 로직을 기계적으로 `helper.ts`로 옮기지 않는다.

```typescript
// DON'T: 서비스 내부 문맥 로직을 기계적으로 helper로 추출
// order.helper.ts
export function validateOrderStatus(order: Order) {
  if (order.status !== 'OPEN') throw ORDER_EXCEPTIONS.ALREADY_CLOSED();
}
// → 이 함수는 OrderService의 유스케이스 흐름에서만 의미가 있다

// DO: 서비스 내부 private 메서드로 유지
class OrderService {
  private validateStatus(order: Order) {
    if (order.status !== 'OPEN') throw ORDER_EXCEPTIONS.ALREADY_CLOSED();
  }
}

// DO: DI 없는 순수 함수 + 여러 곳 재사용 → helper로 분리
// date.helper.ts
export function formatDateRange(start: Date, end: Date): string {
  return `${dayjs(start).format('YYYY-MM-DD')} ~ ${dayjs(end).format('YYYY-MM-DD')}`;
}

// DO: 의존성 필요 + 독립 책임 → 별도 provider
// order-policy.service.ts
@Injectable()
class OrderPolicyService {
  constructor(private readonly configService: ConfigService) {}
  canCancel(order: Order, actor: Actor): boolean { ... }
}
```

---

## 새 기능 추가 체크리스트

1. 소유 도메인을 정한다.
2. 기존 모듈에 넣을지 새 서브도메인을 만들지 정한다.
3. 동기 연결이면 `imports/exports`, 비동기 연결이면 이벤트를 선택한다.
4. 현재 모듈의 구조 패턴을 그대로 따른다.
5. DTO validation, 예외, 로깅, 응답 envelope까지 함께 맞춘다.
6. 엔티티 내부 상태 변경은 엔티티 메서드로 캡슐화한다.
7. 이벤트 payload는 소비하는 도메인의 `event/` 폴더에 둔다.
