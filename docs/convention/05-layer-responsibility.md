# 레이어별 책임

## AI Quick Reference

- **Controller**: 라우팅 + request binding만. 응답은 `R.data`, `R.page`, `R.empty`. 역할 다르면 public/admin 분리
- **Service**: 유스케이스 진입점. DTO를 그대로 받고, 인라인 객체 재조립 금지. auth 정보는 별도 인자
- **Repository**: DB 조회/persistence만. 다른 도메인 repository 직접 주입 금지. 메서드명에 로딩 의도 포함 (`findByIdWithReplies`). 인라인 파라미터(`params: { ... }`) 금지 — Request DTO 그대로 또는 repo 파일 내 interface
- **Entity**: 정적 `create()` 팩토리 + 명시적 수정 메서드. 하위 엔티티는 Aggregate Root 통해 관리
- **Exception**: `exception/` 폴더의 팩토리 상수 사용 (`NOTE_EXCEPTIONS.NOT_FOUND()`). 인라인 `new HttpException` 금지
- **MikroORM 관계**: `ref.id` > `getEntity()` > `load()` > `unwrap()` 우선순위. `populate` 없이 필드 접근 금지
- **DO**: FK relation은 repository에서 `populate`, 외부 도메인은 service에서 배치 조회 후 조합
- **DON'T**: `unwrap().field` 패턴, controller에서 repository 직접 호출, for문 안에서 추가 쿼리
- **복잡 조회**: 집계·대시보드는 Kysely ReadModel로 우회 (`11-query-strategy.md` 참조)

---

## `*.module.ts`

- DI 경계를 정의한다.
- `imports`, `controllers`, `providers`, `exports`를 선언한다.
- 엔티티가 있으면 `MikroOrmModule.forFeature(...)`를 같이 둔다.

## Controller

- 라우팅과 request binding을 담당한다.
- 인증/인가 데코레이터를 선언한다 (`@Requires(action, resourceType)`, `@Public` — `06-access-control.md`).
- DTO validation을 통과한 입력을 서비스로 전달한다.
- 응답은 기본적으로 `R.data`, `R.list`, `R.page`, `R.cursorPage`, `R.empty`를 사용한다.
- 역할이 다르면 public/admin controller를 분리한다.

## Service

- 유스케이스 진입점이다.
- 조회, 존재 검증, 권한 체크 연결, 예외 변환, 로깅, 이벤트 발행을 담당한다.
- 여러 엔티티와 다른 모듈을 조합하는 orchestration을 맡는다.
- 실제 FK 관계로 묶인 데이터는 repository가 `populate`한 결과를 받아 쓰고, 다른 도메인 서비스 호출이나 단순 ID property 기반 외부 데이터 조합은 service가 맡는다.
- 복합 write 작업의 트랜잭션 경계가 되는 경우가 많다.
- **`@Transactional()` 내부에서 `eventEmitter.emit()`을 호출하지 않는다.** 이벤트 핸들러가 fork한 EntityManager가 커밋 전 트랜잭션 커넥션을 공유하여 `Transaction is already committed` 에러를 유발한다. DB 작업은 private `@Transactional()` 메서드로 분리하고, 이벤트는 트랜잭션 완료 후 public 메서드에서 발행한다.
- `@Transactional`은 `@mikro-orm/decorators/legacy`에서 import한다 (`11-query-strategy.md` 참조).
- 유스케이스 내부 보조 로직은 우선 서비스의 `private` 메서드로 두고, 재사용 가능한 순수 함수나 독립 책임이 생길 때만 바깥으로 분리한다.

### Service 분리 패턴

하나의 도메인에서 서비스가 커질 때 아래 기준으로 분리한다.

#### ReadService 분리

조회 전용 로직이 복잡해지면 `*ReadService`로 분리한다.

```typescript
// 분리 전: OrderService에 CRUD + 복잡한 조회 로직이 혼재
// 분리 후:
OrderWriteService    // 생성, 수정, 삭제, 상태 변경
OrderReadService     // 목록 조회, 필터, 접근 제어
OrderDetailService   // 단건 상세 조회, 하위 항목 계층 조립
```

**분리 기준**: 조회 메서드가 5개 이상이거나, 조회에 권한 판단 같은 복합 로직이 들어갈 때.
**위치**: 같은 `service/` 폴더 내에 둔다.

#### Policy 클래스 분리

도메인 정책 판단(접근 권한, 상태 전이 가능 여부 등)이 서비스에서 반복되면 `*.policy.ts`로 분리한다.

```typescript
// note.policy.ts — 팀 소유권 등 엔티티 단위 규칙은 ResourcePolicy를 상속한다 (06-access-control.md)
@Injectable()
export class NotePolicy extends ResourcePolicy<Note> {
  canUpdate(actor: AuthSubject, note: Note): boolean { return this.isTeamMember(actor, note); }
  canDelete(actor: AuthSubject, note: Note): boolean { return this.isTeamOwner(actor, note); }
}
```

**분리 기준**: 동일한 도메인 규칙이 여러 서비스 메서드에서 반복되거나, Guard로 처리하기엔 도메인 엔티티 로딩이 필요한 경우.
**위치**: 서비스와 같은 레벨 (`service/` 폴더 또는 모듈 루트).

### Service 메서드의 입출력 규칙

- **입력**: controller의 request DTO를 그대로 받거나, 서비스 전용 params 타입을 선언해서 받는다. controller에서 인라인 객체 리터럴을 조립해서 넘기지 않는다.
- **출력**: entity 또는 DTO를 반환한다.

```typescript
// 나쁨: controller가 DTO를 풀어서 인라인 객체를 재조립
@Get()
async getList(@Query() query: GetNoteListRequest) {
  const { list, count } = await this.noteService.getNoteList({
    pageNum: query.pageNum,
    pageSize: query.pageSize,
    searchKeyword: query.q,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  });
  ...
}

// 좋음: request DTO를 그대로 전달
@Get()
async getList(@Query() query: GetNoteListRequest) {
  const { list, count } = await this.noteService.getNoteList(query);
  ...
}

// service 쪽
async getNoteList(query: GetNoteListRequest): Promise<{ list: Note[]; count: number }> {
  ...
}
```

- controller에서 auth 정보 등 request DTO에 없는 값을 함께 넘겨야 하면, DTO와 별도 인자로 분리한다.

```typescript
// 좋음: DTO + 별도 인자
@Post()
async create(@CurrentUser() actor: AuthSubject, @Body() body: CreateNoteRequest) {
  return R.data(await this.noteService.createNote(body, actor.id));
}

// service 쪽
async createNote(dto: CreateNoteRequest, requestorId: string | number): Promise<...> {
  ...
}
```

## Repository

- DB 조회와 persistence 세부사항만 담당한다.
- **다른 도메인의 repository를 직접 주입하거나 사용하지 않는다.** 다른 도메인 데이터가 필요하면 해당 도메인의 service(또는 ReadService)를 통해 접근한다.
- **같은 모듈(`*.module.ts`) 안에 함께 등록된 엔티티는 예외다.** 하나의 모듈이 여러 서브 영역을 포함할 때, 같은 `MikroOrmModule.forFeature([...])`에 등록된 엔티티끼리는 repository에서 직접 접근할 수 있다. 집계 쿼리나 JOIN 기반 효율적 조회가 필요한 경우 서비스 계층을 거치면 오히려 N+1이나 불필요한 라운드트립이 발생하므로, 같은 모듈 내 엔티티를 repository에서 직접 사용하는 것이 합리적이다.
- 필터, 정렬, 페이지네이션, populate 조합 같은 쿼리 책임을 모은다.
- 페이지네이션은 서비스가 아닌 repository에서 쿼리 시점에 적용한다. 서비스에서 전체 목록을 가져온 뒤 잘라내지 않는다.
- DB 조회 결과를 순회할 때 for문 안에서 추가 쿼리를 실행하지 않는다. 필요한 데이터는 `populate`, `IN` 조건, 배치 조회 등으로 한 번에 가져온다.
- FK로 실제 연결된 관계를 언제 로딩할지는 repository 메서드가 결정한다.
- 메서드 이름에 로딩 의도를 드러낸다. 예: `findByIdWithReplies`, `findByIdWithItems`
- 많은 저장소가 `BaseRepository<T>` 패턴을 따른다 (`src/common/base/base.repository.ts`).

### Repository 메서드 파라미터 규칙

Repository 메서드의 파라미터에 인라인 객체 타입(`params: { ... }`)을 사용하지 않는다.

- **Request DTO와 파라미터가 동일할 때**: Request DTO를 그대로 전달한다.
- **Request DTO와 파라미터가 다를 때**: repository 파일 내부에 `export interface`로 명시적 파라미터 타입을 정의한다.

```typescript
// DON'T: 인라인 객체 파라미터
async findPaginated(params: {
  ownerId: number;
  offset: number;
  limit: number;
}): Promise<[Note[], number]>

// DO: Request DTO와 동일하면 그대로 사용
async findPaginated(query: GetNoteListRequest): Promise<[Note[], number]>

// DO: Request DTO와 다르면 repository 파일 내 interface 정의
export interface FindNotePaginatedParams {
  ownerId: number;
  offset: number;
  limit: number;
}
async findPaginated(params: FindNotePaginatedParams): Promise<[Note[], number]>
```

- interface 이름은 `메서드명(PascalCase) + Params` 형식을 기본으로 한다. 예: `FindNotePaginatedParams`, `CountByOwnerParams`
- Service가 Request DTO를 가공해서 Repository에 넘기는 경우도 동일하게 repository 파일 내 interface를 정의한다.

### Soft Delete 필터 규칙

- 전역 soft delete 필터는 `src/lib/database/mikro-orm.config.ts`에 정의한다. 현재 `filters.softDelete = { cond: { deletedAt: null }, default: true }`로 설정되어 있다.
- 따라서 `find`, `findOne`, `findAndCount`, `count`, `nativeUpdate`, `nativeDelete` 같은 MikroORM 기본 API에서는 루트 엔티티의 `deletedAt: null`을 반복해서 넣지 않는 것을 기본값으로 삼는다.
- soft-deleted 행까지 포함해야 하면 `filters: false` 또는 목적이 드러나는 별도 메서드로 의도를 명시한다.
- `createQueryBuilder()`는 전역 필터가 자동 적용되지 않으므로, QueryBuilder를 쓸 때는 `await qb.applyFilters()`를 호출하거나 `deletedAt` 조건을 직접 추가해야 한다.
- 관계 엔티티까지 soft delete 제외가 필요하면, 루트 엔티티 자동 필터만 믿지 말고 relation 쪽 조건이 필요한지 함께 검토한다.

## Entity

- 스키마와 상태 변경 메서드를 함께 가진다.
- 생성은 `create(...)` 정적 팩토리로 시작하는 패턴이 많다.
- 수정은 `update(...)`, `changeStatus(...)`, `replace...(...)` 같은 명시적 메서드로 캡슐화한다.
- 하위 엔티티가 `ManyToOne`으로 상위 엔티티를 가리키고 생명주기가 함께 움직이면, 생성/추가/교체/삭제는 기본적으로 상위 엔티티 메서드에서 감싼다.
- 이런 하위 엔티티는 독립 repository보다 aggregate root를 통해 관리하는 쪽을 기본값으로 본다.
- 공통 필드/메서드는 `BaseEntity`(`src/common/base/base.entity.ts`)를 상속한다.
- 낙관적 락이 필요한 엔티티(상태 전이·재고/잔액 등 동시 수정이 치명적인 경우)는 `VersionedEntity`(`src/common/base/versioned.entity.ts`)를 상속한다.

### 엔티티 메서드 경계 (어디까지 엔티티에 넣나)

빈약한(anemic) 모델 — 게터/세터만 있고 로직은 전부 서비스 — 도, 과한 모델 — 엔티티가 DB/외부 API를 호출 — 도 피한다. **판정 기준 한 줄: "이 엔티티 + 자기 aggregate 자식만으로 판단 가능한가?"**

**엔티티 안에 둔다 (도메인 모델):**

- 불변식(invariant) 검증 — 자기 필드 조합이 유효한지 (예: `startAt < endAt`)
- 상태 전이 — `changeStatus()`, 전이 가능 여부(State Machine). 전이 위반은 예외 팩토리로 던진다
- 자기 필드로 끝나는 파생값 — `isExpired()`, `get total()`
- **자기 aggregate 내부 자식 생명주기** — `addComment()`, `removeItem()` (aggregate root 패턴)
- 생성(`create()` 정적 팩토리)과 캡슐화 수정자(`update()`, `replaceItems()`)

**서비스에 둔다 (엔티티 밖):**

- 다른 엔티티/도메인과의 조합·orchestration
- I/O — repository, mail, 외부 API, 파일/스토리지
- 인가 판단(누가 이 작업을 할 수 있는가) — Guard/Policy
- 트랜잭션 경계, 이벤트 발행
- 다른 도메인 데이터를 읽어야 내릴 수 있는 결정

```typescript
// 엔티티: 자기 상태로 끝나는 규칙
class Order extends BaseEntity {
  changeStatus(next: OrderStatus): void {
    if (!Order.TRANSITIONS.get(this.status)?.has(next)) throw ORDER_EXCEPTIONS.INVALID_TRANSITION();
    this.status = next;
  }
}

// 서비스: 바깥(repo·다른 도메인·이벤트)을 봐야 하는 흐름
async cancelOrder(orderId: number, actor: AuthSubject): Promise<void> {
  const order = await this.repo.getById(orderId); // I/O
  this.orderPolicy.assertCanCancel(order, actor); // 인가
  order.changeStatus(OrderStatus.CANCELLED);      // ← 규칙 자체는 엔티티에 위임
  await this.repo.save(order);
  this.eventEmitter.emit('order.cancelled', { orderId }); // 이벤트
}
```

### 엔티티 필드 추가 시 변경 경로 전수 조사

엔티티에 새 필드를 추가하면, 해당 필드 값이 변경되는 **모든 경로**를 추적하여 의도한 값이 설정되는지 확인한다.

- **생성**: `create()` 정적 팩토리에서 올바른 기본값/파라미터 반영
- **복원**: soft-deleted 레코드를 `restore()`하는 모든 서비스 메서드에서 필드가 올바르게 초기화/갱신되는지 확인. 이전 값이 남아있으면 의도치 않은 동작을 유발한다.
- **수정**: `update()` 등 명시적 수정 메서드에서 해당 필드 포함 여부 결정
- **삭제**: soft delete 시 필드 보존/초기화 여부 결정

특히 soft delete + restore 패턴에서는 **복원 경로가 여러 서비스에 분산**되어 있을 수 있으므로, 해당 엔티티를 `restore()`하는 모든 호출처를 grep으로 찾아 검증한다.

```typescript
// ❌ restore 시 새 필드를 고려하지 않음 — 이전 값이 살아남아 버그 유발
softDeleted.restore();

// ✅ restore 시 경로에 맞는 값으로 명시적 설정
softDeleted.restore();
softDeleted.autoSync = false;
```

## DTO

- request DTO는 validation/transformation을 담당한다.
- response DTO는 엔티티를 API 응답 형태로 매핑한다.
- frontend가 OpenAPI 기반 클라이언트(예: orval)로 DTO 이름을 직접 보게 되므로, DTO 클래스명은 모듈 내부 문맥이 아니라 API 계약 기준으로 짓는다 (`07-naming-and-style.md`).
- request/response DTO 클래스명은 전역에서 충돌하지 않도록 `행위 + 대상 + 필요 시 수식어 + Request/Response` 형식을 기본값으로 쓴다.
  - 예: `GetNoteListRequest`, `CreateNoteRequest`, `ValidateTokenResponse`
- 중첩 응답이나 재사용되는 읽기 전용 응답 조각은 `대상 + Data/ItemData/SummaryData/DetailData` 형식을 쓴다.
  - 예: `NoteData`, `NoteListItemData`, `OwnerSummaryData`
- 금지 예시: `CreateRequest`, `ListResponse`, `UserDto`, `ResponseDto`처럼 전역에서 의미가 약한 이름

### DTO 파일 작성 규칙

- 기본값은 "하나의 행위(action)에 대한 Request + Response를 하나의 `.dto.ts` 파일에 bundling"이다.
  - 파일명은 `kebab-case`의 `행위-대상.dto.ts`를 기본으로 한다.
  - 파일 안에는 `...Request`, `...Response`, 그리고 그 행위에 종속된 작은 nested DTO를 함께 둘 수 있다.
  - 예: `get-note-list.dto.ts` 안에 `GetNoteListRequest`, `GetNoteListResponse`, `NoteListItemData`
- **파일 suffix는 `.dto.ts`로 통일한다.** `.request.ts` / `.response.ts`로 분리하지 않는다.
- 파일 크기가 대략 200줄을 넘기기 시작하면 분리를 검토한다. 이 때도 `.dto.ts` suffix를 유지한다.

#### 공유 Data 클래스 배치

여러 endpoint에서 공유되는 Response Data 클래스(`...Data`, `...ItemData` 등)는 **가장 기본이 되는 행위의 dto 파일에 정의**하고, 다른 dto 파일에서 import한다.

```typescript
// dto/get-note.dto.ts — NoteData의 "홈" 파일
export class NoteData { ... }           // 여기서 정의
export class GetNoteRequest { ... }
export class GetNoteResponse { ... }

// dto/get-note-list.dto.ts — NoteData를 import
import { NoteData } from './get-note.dto';
export class GetNoteListRequest { ... }
export class GetNoteListResponse {
  list: NoteData[];
  count: number;
}
```

- **"홈" 파일 결정 기준**: 해당 Data 클래스가 가장 자연스럽게 속하는 행위의 dto. 보통 단건 조회(get-detail)가 홈이 된다.
- 홈이 애매하면 가장 먼저 정의된 파일을 홈으로 삼는다.

## Exception

- 도메인별 예외 팩토리 상수 객체를 사용한다.
- 예: `NOTE_EXCEPTIONS`, `ORDER_EXCEPTIONS`
- 폴더명은 `exception/`으로 모듈 스타일을 통일한다.
- **에러는 반드시 `exception/` 아래 예외 팩토리 상수에 선언하고, 서비스에서 해당 상수를 호출해서 던진다.** `new Error(...)`, `new HttpException(...)` 같은 인라인 예외 생성은 금지한다. (공통 베이스는 `src/common/exceptions/http.exception.ts`.)
- **에러는 최대한 책임을 가진 최하위 서비스에서 발생시킨다.** A 서비스가 B 서비스를 호출할 때, 입력값 검증이나 존재 여부 확인 같은 에러는 B 서비스 내부에서 처리한다. A 서비스는 호출만 하고, B 서비스의 검증을 중복으로 수행하지 않는다.

```typescript
// 나쁨: A 서비스에서 B 서비스의 검증을 중복 수행
async assignOrder(ownerId: number, orderId: number) {
  const order = await this.orderService.findById(orderId);
  if (!order) throw new Error('주문을 찾을 수 없습니다.');  // ❌ 인라인 에러, 중복 검증
  ...
}

// 좋음: B 서비스가 자기 도메인의 검증을 책임지고, A 서비스는 호출만
// order.service.ts
async getOrder(orderId: number): Promise<Order> {
  const order = await this.repo.findById(orderId);
  if (!order) throw ORDER_EXCEPTIONS.NOT_FOUND();  // ✅ 예외 팩토리 사용
  return order;
}
```

## Event Handler

- 폴더명은 `handler/`로 통일한다. (`listener/` 사용하지 않는다.)
- 원본 write 이후의 후처리를 담당한다.
- 알림 전송, 파생 데이터 생성, 동기화 후속 작업을 둔다.
- 원본 서비스의 핵심 비즈니스 규칙을 handler로 밀어 넣지 않는다.

## Unit of Work / EntityManager 스코프

- HTTP 요청 경로는 `@mikro-orm/nestjs`가 **요청마다 EntityManager를 fork**(RequestContext)해 주므로 identity map이 요청 간 격리된다. 서비스/레포는 주입받은 EM을 그대로 쓴다.
- **요청 스코프 밖**에서 도는 코드 — 크론 잡, `EventEmitter2` 핸들러의 async 흐름, 부트스트랩 스크립트 — 는 RequestContext가 없으므로 **반드시 EM을 fork**한다. 안 하면 전역 EM 공유로 `allowGlobalContext` 에러나 identity map 오염이 난다.
  - NestJS 메서드: `@CreateRequestContext()` 데코레이터(MikroORM 제공)를 핸들러/크론 메서드에 단다.
  - 수동: `await this.em.fork().transactional(...)` 또는 `const em = this.orm.em.fork()`.
- `@Transactional()` 내부에서 `eventEmitter.emit()`을 호출하지 않는다(커밋 전 핸들러 EM 공유로 충돌). 이벤트는 트랜잭션 완료 후 발행한다(위 Service 규칙 참조).

---

## MikroORM 관계 처리 규칙

### 기본 개념

- `@ManyToOne(() => X, { ref: true })`는 보통 `Ref<X>`로 선언한다.
- `ref(entity)` 또는 `ref(Entity, id)`는 "이 엔티티를 참조한다"는 FK 연결 표현이다.
- `populate`는 "관계를 실제로 로딩한다"는 계약이다. relation 내부 필드가 필요하면 repository에서 미리 `populate`하거나 `load()`로 초기화해야 한다.
- `unwrap()`은 로딩 없이 내부 엔티티 객체에 접근하는 동기 API다. `populate`를 보장하지 않으므로, id 수준 접근이나 이미 메모리에 올라온 그래프를 다룰 때만 제한적으로 쓴다.
- `getEntity()`는 relation이 초기화되지 않았으면 예외를 던진다. "여기는 이미 populate/load가 끝났다"가 보장될 때만 쓴다.
- `OneToMany` 컬렉션도 마찬가지다. `populate`하지 않았으면 `getItems()` 결과를 당연하게 믿지 말고, 로딩 보장이 있는 repository 메서드 또는 `isInitialized()` 확인과 함께 사용한다.

### `load()`, `getEntity()`, `unwrap()` 사용 기준

1. 필요한 relation이 처음부터 명확하면 repository 메서드에서 `populate`해서 가져온다.
2. 로딩 완료가 보장된 relation을 동기 접근할 때만 `getEntity()`를 쓴다.
3. `load()`는 조건부로 한 번만 더 읽는 예외 상황에서만 쓴다.
4. `unwrap()`은 제한적으로만 쓴다. 특히 필드 접근 용도로 습관처럼 쓰지 않는다.

**실무 운영 규칙 요약**

- PK만 필요하면 `ref.id`
- 이미 로딩된 relation의 필드가 필요하면 `getEntity()`
- 조건부 추가 조회가 정말 필요할 때만 `await ref.load()`
- 그 외 `unwrap()`은 지양

```typescript
// 나쁨
const ownerId = note.owner.unwrap().id;

// 좋음: PK만 필요하면 Ref의 id 사용
const ownerId = note.owner.id;

// 좋음: 필드가 필요하면 로딩 계약 후 getEntity 사용
const ownerName = note.owner.getEntity().name;
```

**왜 `unwrap()`을 지양하나**

- `unwrap()`은 로딩 계약이 깨져도 바로 드러나지 않는다. `getEntity()`는 계약이 깨지면 즉시 예외가 나므로 "이 relation을 누가 로딩해야 하는가"가 빨리 드러난다.

### `ManyToOne` 관계의 Aggregate Root 패턴

하위 엔티티가 상위 엔티티를 `ManyToOne`으로 참조하고, 하위 엔티티가 상위 엔티티 없이는 의미가 없다면 상위 엔티티를 aggregate root로 본다.

```typescript
@OneToMany(() => NoteComment, (comment) => comment.note, {
  cascade: [Cascade.ALL],
  orphanRemoval: true,
})
comments = new Collection<NoteComment>(this);

addComment(content: string, authorId: number): NoteComment {
  const comment = NoteComment.create({ authorId, content });
  this.comments.add(comment);
  return comment;
}
```

- 하위 엔티티의 생성/수정/삭제 흐름은 상위 엔티티 메서드(`addComment`, `updateComment`, `removeComment`)로 감싼다.
- 서비스는 상위 엔티티만 조회해서 규칙을 검증하고 저장한다.

```typescript
// repository
async findByIdWithComments(id: number): Promise<Note | null> {
  return this.findOne({ id }, { populate: ['comments'] });
}

// service
async addComment(noteId: number, content: string, authorId: number): Promise<NoteComment> {
  const note = await this.repo.findByIdWithComments(noteId);
  if (!note) throw NOTE_EXCEPTIONS.NOT_FOUND();
  const comment = note.addComment(content, authorId);
  await this.repo.save(note);
  return comment;
}
```

### 조회 책임 경계

1. 같은 aggregate / 같은 ORM relation이면 **repository + `populate`**
2. 다른 도메인 / scalar ID 참조면 **service orchestration** (또는 다른 도메인의 ReadService)
3. 조합 조회가 반복되고 복잡해지면 repository를 비대하게 만들기보다 별도 ReadService 또는 Kysely ReadModel을 검토 (`11-query-strategy.md`)

### Raw SQL / 복잡 조회 가이드라인

ORM의 QueryBuilder로 표현하기 어려운 복잡한 집계 쿼리나 대시보드 조회는 Kysely ReadModel로 작성하는 것을 기본으로 한다(`11-query-strategy.md`). 불가피하게 `em.getConnection().execute()`를 쓸 때는:

- raw SQL은 **읽기 전용 조회에만** 사용한다. write 작업은 반드시 ORM을 통한다.
- raw SQL을 사용하는 메서드는 repository 또는 read service에 둔다. service에 직접 두지 않는다.
- 쿼리에 사용자 입력을 넣을 때는 반드시 **parameterized query**를 사용한다. 문자열 연결 금지(SQL injection).
- 결과 타입을 명시적으로 선언한다 (return type에 `any` 사용 금지).

```typescript
// DO: parameterized query + 명시적 결과 타입 + repository에 위치
interface OwnerStatRow { ownerId: number; noteCount: number; }

async getOwnerStats(ownerIds: number[]): Promise<OwnerStatRow[]> {
  const conn = this.em.getConnection();
  return conn.execute<OwnerStatRow[]>(
    `SELECT owner_id as "ownerId", COUNT(*) as "noteCount"
     FROM notes WHERE owner_id = ANY(?) AND deleted_at IS NULL GROUP BY owner_id`,
    [ownerIds],
  );
}

// DON'T: 문자열 연결로 SQL 조립 → SQL injection
const result = await conn.execute(`SELECT * FROM notes WHERE owner_id = ${ownerId}`);
```
