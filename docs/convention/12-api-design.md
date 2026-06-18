# API 설계

REST 엔드포인트의 URL·HTTP 시맨틱·설계 결정 절차를 정한다. 이 문서는 "URL을 어떻게 정하나"에 집중하며,
네이밍/orval 계약은 [07-naming-and-style.md](07-naming-and-style.md), 인가는 [06-access-control.md](06-access-control.md),
조회 경로 선택은 [11-query-strategy.md](11-query-strategy.md)를 따른다 (중복 서술하지 않는다).

## AI Quick Reference

- **URL = 리소스(명사), 행위 = HTTP 메서드**. URL에 동사 금지 (`POST /orders`, `GET /orders/:id` — `/createOrder` ❌)
- **kebab-case + 복수형**: `/order-items`, `/password-resets` (단수·camelCase URL 금지)
- **중첩은 1단계까지**: `GET /orders/:id/items` (O) / `/users/:id/orders/:oid/items` (❌ 평탄화)
- **상태전이만 동사 액션 허용**: `POST /orders/:id/cancel`, `POST /auth/login`
- **컬렉션 필터·정렬·페이지는 전부 쿼리스트링** → 베이스 DTO 조합([07](07-naming-and-style.md#query-dto-베이스-필터검색페이지네이션))
- **관리자/공개 컨트롤러 분리**: `order.controller.ts` ↔ `order.admin.controller.ts`
- **상태코드 고정**: 생성 201 · 조회/수정 200 · 삭제 204 · 검증실패 400 · 인가실패 403 · 없음 404 · 충돌 409
- **메서드명은 path scope 안 행위만**: `create/getList/getDetail/update/delete` (도메인명 반복 ❌ → [07](07-naming-and-style.md#controller-method명))
- **URL·DTO·상태코드는 `/spec` 단계에서 확정** → `/scaffold`로 골격 생성 → `/review`·CI가 검증
- 컨트롤러/DTO JSDoc은 그대로 Swagger·orval로 흐른다 → [CLAUDE.md "Swagger / API 문서"](../../CLAUDE.md)

---

## 1. 리소스 모델링

- URL은 **무엇(리소스)**을 가리키고, **무엇을 할지(행위)**는 HTTP 메서드로 표현한다.
- 리소스는 도메인 명사의 **복수형 컬렉션**이다: `/orders`, `/notes`, `/order-items`.
- 단건은 컬렉션 + 식별자: `/orders/:id`.
- 동작·계산·보고서처럼 명사가 아닌 것도 가능한 한 리소스로 모델링한다 (예: "검색"은 `/orders?q=...`, "요약"은 `/orders/summary`).

```
POST   /orders          주문 생성
GET    /orders          주문 목록 (필터/정렬/페이지는 쿼리스트링)
GET    /orders/:id      주문 단건
PATCH  /orders/:id      주문 부분 수정
DELETE /orders/:id      주문 삭제
```

## 2. URL 규칙

| 규칙 | ✅ | ❌ |
| ---- | -- | -- |
| kebab-case + 복수형 | `/order-items` | `/orderItems`, `/orderItem` |
| URL에 동사 금지 | `POST /orders` | `POST /orders/create`, `/createOrder` |
| 중첩 1단계까지 | `/orders/:id/items` | `/users/:uid/orders/:oid/items` |
| 식별자는 path, 필터는 query | `/orders/:id`, `/orders?status=paid` | `/orders?id=1`, `/orders/status/paid` |
| 약어보다 전체 단어 | `/notifications` | `/notis` |

- **중첩 2단계 이상이 필요하면 평탄화한다**: 하위 리소스를 최상위로 올리고 쿼리로 필터. `GET /order-items?orderId=:id`.
- **상태전이/비-CRUD 액션은 명시적 동사 하위 경로로 허용한다** (드물게): `POST /orders/:id/cancel`, `POST /orders/:id/restore`, `POST /auth/login`. 단 CRUD로 표현 가능한 건 동사 액션으로 만들지 않는다.

## 3. HTTP 메서드 ↔ 컨트롤러 매핑

| 메서드 | 의미 | 멱등성 | 컨트롤러 메서드명 | 상태코드 |
| ------ | ---- | ------ | ----------------- | -------- |
| POST   | 생성 / 비-CRUD 액션 | ✗ | `create`, `cancel`, `login` | 201 (생성) / 200 (액션) |
| GET    | 조회 | ✓ | `getList`, `getDetail`, `getMine` | 200 |
| PATCH  | 부분 수정 | ✗ | `update`, `changeStatus` | 200 |
| PUT    | 전체 교체 (드묾, 보통 PATCH 선호) | ✓ | `replace` | 200 |
| DELETE | 삭제 | ✓ | `delete`, `deleteList` | 204 |

- 부분 수정은 **PATCH가 기본**. PUT(전체 교체)은 클라이언트가 전체 표현을 보낼 때만.
- 메서드명 규칙 상세는 [07-naming-and-style.md](07-naming-and-style.md#controller-method명).

## 4. 상태코드 표준

| 코드 | 상황 |
| ---- | ---- |
| 200 OK | 조회·수정·액션 성공 (본문 있음) |
| 201 Created | 리소스 생성 성공 (`@Post`) — Swagger 응답도 `@ApiDataResponse(Data, 201)`로 명시 |
| 204 No Content | 삭제 등 본문 없는 성공 |
| 400 Bad Request | DTO 검증 실패 (class-validator) |
| 401 Unauthorized | 인증 누락/실패 (AuthGuard) |
| 403 Forbidden | 인증됐으나 권한 부족 (PolicyGuard/`@Requires` 또는 ResourcePolicy) |
| 404 Not Found | 리소스 없음 — service의 `getBy...`가 예외 팩토리로 변환 |
| 409 Conflict | 상태 충돌 (중복 생성, 잘못된 상태전이) |

- 예외는 **인라인 금지**, 도메인 `exception/` 팩토리 상수를 던진다 (`05-layer-responsibility.md`). 성공 응답은 `R.*` envelope.

## 5. 컬렉션 규약 (필터·정렬·페이지네이션)

- 목록 조회의 필터·정렬·페이지 파라미터는 **전부 쿼리스트링**이며, 매번 새로 선언하지 않고 베이스 DTO를 `IntersectionType`으로 조합한다.
- offset vs cursor 선택 기준은 [11-query-strategy.md](11-query-strategy.md), 베이스 DTO(`OffsetPageQuery`/`CursorPageQuery`/`KeywordQuery`)와 응답 `R.page`/`R.cursorPage` 매핑은 [07-naming-and-style.md](07-naming-and-style.md#query-dto-베이스-필터검색페이지네이션) 참조.

```
GET /orders?status=paid&q=노트북&sortBy=createdAt&sortOrder=DESC&pageNum=1&pageSize=20
```

## 6. JSDoc 작성 정석 (Swagger·orval 직결)

SWC 빌드에서는 `pnpm metadata`가 JSDoc을 OpenAPI로 변환한다 (배선: [CLAUDE.md "Swagger / API 문서"](../../CLAUDE.md)). FE가 "딱 보고 이 API구나"를 알려면:

```typescript
@ApiTags('orders')              // orval 파일 분리 단위 (orders.ts)
@Controller('orders')
export class OrderController {
  /**
   * 주문 목록 조회                  ← 첫 줄 = operation summary = orval 함수 설명
   *
   * 상태·기간으로 필터링하며 offset 페이지네이션을 사용한다.   ← 본문 = description
   */
  @Get()
  @ApiDataResponse(OrderListData)   // 응답 타입 명시 → orval 반환 타입 확정
  getList(@Query() query: GetOrderListRequest) {}   // 짧은 메서드명 → orderControllerGetList()
}
```

```typescript
export class OrderData {
  /** 주문 고유 ID */
  id!: string;

  /** 주문 상태 @example "paid" */
  status!: OrderStatus;   // bare union 금지, enum 필수 ([07](07-naming-and-style.md))

  /** 쿠폰 코드. 미적용 시 응답에서 키 자체가 빠진다. */
  couponCode?: string;    // `| null` 금지, optional만
}
```

- **summary(JSDoc 첫 줄)**·**함수명(메서드명)**·**타입명(DTO 클래스명)** 3개가 orval 산출물의 가독성을 좌우한다.
- `@ApiOperation()`·`@ApiProperty()` 수동 선언은 지양한다 (JSDoc + class-validator로 대체).

## 7. 설계 결정 워크플로 (가드레일)

URL·DTO·상태코드를 **개발자가 코딩 중에 즉흥으로 정하지 않게** 한다. 결정을 코드 앞으로 당기고, 기계가 검증한다.

1. **`/spec`** — PRD를 기술 스펙으로. URL·메서드·DTO·상태코드를 시니어가 합의해 스펙에 박제한다.
2. **`/issues` → `/scaffold`** — 합의된 스펙으로 컨트롤러/DTO 골격을 생성. 빈 캔버스에서 URL을 발명할 여지를 없앤다.
3. 코딩 — 골격 위에서 비즈니스 로직만 채운다.
4. **`/review` + CI** — 이 문서·07의 위반(동사 URL, 중첩 과다, 메서드명 반복, envelope 누락)을 검출·차단한다.

> 신입이 도메인을 몰라도 **스펙 합의 → 스캐폴딩 → 자동 검증** 레일 위에서만 달리게 만드는 것이 핵심이다.

## 8. 안티패턴

```
❌ POST /createOrder                  →  ✅ POST /orders
❌ GET  /orders/getList               →  ✅ GET  /orders
❌ POST /orders/:id/updateStatus      →  ✅ PATCH /orders/:id           (또는 상태전이면 POST /orders/:id/cancel)
❌ GET  /users/:uid/orders/:oid/items →  ✅ GET  /order-items?orderId=:oid
❌ GET  /orderList, /noteDetail       →  ✅ GET  /orders, /notes/:id
❌ DELETE → 200 + {success:true}      →  ✅ DELETE → 204 No Content
❌ status!: 'draft' | 'published'     →  ✅ enum NoteStatus (orval unknown 방지, [07])
```

## 9. 새 엔드포인트 체크리스트

1. 리소스 명사·복수형·kebab-case URL을 정한다 (동사 없는지 확인).
2. 행위에 맞는 HTTP 메서드·상태코드를 고른다 (4번 표).
3. 컬렉션이면 베이스 쿼리 DTO를 조합한다 (5번).
4. DTO 클래스명(`행위+대상+Request/Response`)·필드 enum·nullable 규칙을 [07](07-naming-and-style.md)대로.
5. `@Requires(action, resourceType)` 또는 `@Public()`으로 접근제어를 건다(default-deny). 소유권은 service의 `ResourcePolicy` ([06](06-access-control.md)).
6. 컨트롤러 메서드·DTO 필드에 JSDoc(summary·`@example`)을 단다 (6번).
7. 응답은 `R.*` envelope, 예외는 도메인 팩토리 상수.
8. `/review`로 위반을 점검한다.
