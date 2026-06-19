# 접근제어 (RBAC + ABAC)

> **상태: 구현됨.** 엔진은 `src/lib/access-control/`, **레퍼런스 구현은 `src/modules/identity/`**(User / Team / Role)
> 와 `src/modules/auth/`(로그인·토큰)다. 이 문서의 코드 예시는 전부 실제 구현을 가리킨다.

backend-template는 **역할(Role) 기반 capability(RBAC) + 소속팀 소유권(ABAC)**을 default-deny로 제공한다.
AWS IAM과 유사하게 "어떤 역할이 어떤 리소스에 어떤 액션을 할 수 있는가"를 명시 선언해야 통과한다.
엔진(데코레이터/가드/베이스/평가기)은 도메인 비종속이고, **역할×액션 매트릭스·소유권 정책·토큰 발급은 도메인**이
구현한다 — `identity` 모듈이 그 레퍼런스다.

## AI Quick Reference

- **default-deny**: 보호 라우트는 `@Requires(action, resourceType)` 또는 `@Public()`이 **없으면 거부**. 인증만으로 통과하지 않는다.
- **3-tier**: Tier0 인증(`AuthGuard`+blocklist) → Tier1 RBAC(`PolicyGuard`+`@Requires`, DB 안 침) → Tier2 ABAC(`ResourcePolicy`, 엔티티 소유권).
- **Tier1 = 역할 capability** — 주체의 **역할(Role) 이름**(예: `RED`/`BLUE`)을 키로 역할×액션 매트릭스를 본다. teamId·DB 불필요.
- **Tier2 = 소속팀 소유권 + 직위** — 엔티티 로드 후 service에서 `policy.authorize(actor, action, entity)`/`loadAndAuthorize(...)`. 소속팀(Team) 소유 + 직위(LEADER/MEMBER) 판정.
- **두 개의 "역할"을 구분**: ① **Role**(capability, Red/Blue) = Tier1 매트릭스 키. ② **TeamPosition**(LEADER/MEMBER) = 팀 내 직위, Tier2 소유권 정제용. JWT에서 전자는 `role` 클레임, 후자는 `teams[].role` 슬롯에 실린다.
- **`SUPER`(globalRoles)는 전체 bypass** (IAM root) — Tier1·Tier2 모두 즉시 통과.
- 액션: `create / read / update / delete / manage(=*)` + 커스텀 문자열(`order:cancel`).

## 모델 개요 (3-Tier)

| Tier       | 위치                                                    | 질문                                         | DB                | 실패 |
| ---------- | ------------------------------------------------------- | -------------------------------------------- | ----------------- | ---- |
| **0 인증** | `AuthGuard` (`src/core/auth/`)                          | 토큰이 유효하고 강제로그아웃되지 않았나?     | Redis (blocklist) | 401  |
| **1 RBAC** | `PolicyGuard` + `@Requires` (`src/lib/access-control/`) | 이 주체의 역할이 이 리소스 타입에 이 액션을? | 없음 (JWT claim)  | 403  |
| **2 ABAC** | `ResourcePolicy<TEntity>` (service에서 호출)            | 이 리소스가 actor의 소속팀 것이고 권한 있나? | 엔티티 로드       | 403  |

가드 등록 순서(APP_GUARD): `ThrottlerGuard` → `AuthGuard`(인증) → `PolicyGuard`(인가). Tier2는 가드가 아니라 service 내부에서 호출한다(엔티티를 로드해야 하므로).

## 인증 주체 (AuthSubject) & JWT

`AuthGuard`가 토큰 검증 후 `request.user`에 주입한다. (엔진 타입은 `src/lib/access-control/auth-subject.type.ts`)

```ts
interface TeamMembership {
  teamId: number;
  role: string; // 팀 내 직위(TeamPosition: LEADER/MEMBER). Tier2 소유권 정제용
}

interface AuthSubject {
  id: string | number; // JWT sub
  jti: string; // 강제 로그아웃 blocklist 키
  globalRoles: GlobalRole[]; // 플랫폼 운영 역할 (SUPER = 전체 bypass)
  teams: TeamMembership[]; // 소속팀 + 직위
  [key: string]: unknown; // 도메인 확장: identity는 `role: {id, name}`(capability) 클레임을 더 싣는다
}
```

JWT 페이로드 예시(identity 발급, `token.service.ts`):

```jsonc
{
  "sub": 42,
  "jti": "abc-123",
  "globalRoles": [],
  "role": { "id": 3, "name": "RED" }, // ← Tier1 capability 키 (역할 = Role 엔티티)
  "teams": [{ "teamId": 7, "role": "LEADER" }], // ← teams[].role 슬롯 = 직위(position)
  "exp": 1717891200,
}
```

토큰 정책(identity 구현): Access 15분 HS256(가드에서 디코드, DB 안 침) / Refresh 7일·분리 시크릿(Redis, rotation+family 재사용탐지) / 강제 로그아웃은 Redis blocklist(`blocked:{jti}`, TTL = access TTL).

## Tier 0 — 인증 (`AuthGuard` + blocklist)

`AuthGuard`(`src/core/auth/auth.guard.ts`)는 ① `@Public()`이면 스킵 ② `Authorization: Bearer` JWT 서명+alg 검증 ③ **`jti` 없으면 거부**(blocklist로 무효화 불가) ④ **`blocked:{jti}` Redis 조회 — 존재하면 401**(강제 로그아웃) ⑤ `AuthSubject` 주입. 토큰 발급/리프레시/blocklist 등록(로그인/로그아웃)은 `auth` 모듈이 구현한다.

## Tier 1 — RBAC (`@Requires` + `PolicyGuard`, DB 안 침)

```ts
import { Requires, Action } from '@/lib/access-control';

@Requires(Action.CREATE, 'user') // 이 라우트엔 (user 리소스 × create) capability가 필요
@Post()
create(@CurrentUser() actor: AuthSubject, @Body() body: CreateUserRequest) {}
```

`PolicyGuard`(`policy.guard.ts`) 판정 순서:

1. `@Public()`이면 통과(인증 자체 스킵).
2. `@Requires`가 **없으면 거부**(default-deny). 인증만으로는 통과하지 않는다.
3. `actor.globalRoles`에 `SUPER`가 있으면 **즉시 통과**(IAM root bypass).
4. `AccessPolicyProvider.can(actor, action, resourceType)`로 capability 판정. (주체의 역할 이름 → 매트릭스)

Tier1은 **클래스 단위 capability**("이 등급이 user를 만들 수 있나")만 본다. "이 **특정** user가 내 소속팀인가"는 Tier2가 본다. teamId를 요청에서 뽑지 않는다.

```ts
// 액션(action.enum.ts). 커스텀 문자열도 허용: 'order:cancel'. MANAGE = 와일드카드(모든 액션).
enum Action {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  MANAGE = 'manage',
}

// 매트릭스 평가기(access-policy.provider.ts). 주체에서 역할 키를 뽑는 RoleResolver를 도메인이 주입한다.
interface AccessPolicyProvider {
  can(subject: AuthSubject, action: ActionLike, resourceType: string): boolean;
}
```

### identity 레퍼런스 매트릭스 (`modules/identity/access/identity-access.matrix.ts`)

매트릭스 **키 = 역할(Role) 이름**(대문자 정규화). 사용자는 소속팀 1개 → 그 팀의 역할로 capability가 전이된다.

```ts
export const IDENTITY_ROLE_MATRIX: RoleActionMatrix = {
  RED: { user: [Action.MANAGE] }, // 운영 역할 — user 전부 관리(CRUD)
  BLUE: { user: [Action.READ] }, // 읽기 역할 — user 읽기만
};
// team / role 리소스는 어떤 역할에도 미부여 → SUPER만 통과(플랫폼 구조 관리).
// 합성 루트(app.module)가 ACCESS_POLICY_PROVIDER에 StaticAccessPolicyProvider(매트릭스, resolveAccessRoles)를 바인딩.
```

> 매트릭스 키는 **대문자 정규화**된다(resolver가 `role.name.toUpperCase()`). casing 불일치로 인한 조용한 default-deny를 막는다. 런타임 편집(관리자가 역할 정의)이 필요하면 `AccessPolicyProvider`를 DB 구현으로 교체한다(코드 기본 + DB 오버레이).

## Tier 2 — ABAC (`ResourcePolicy<TEntity>`, 소속팀 소유권)

Tier1은 "역할 등급이 이 리소스 타입을 다룰 수 있나"만 본다. "이 **특정 인스턴스**가 actor의 소속팀(Team) 소유인가, actor가 팀장인가, 본인인가"는 엔티티를 로드해야 알 수 있으므로 **service에서** 판정한다.

```ts
// resource-policy.base.ts
abstract class ResourcePolicy<TEntity extends TeamScoped /* { team: { id: number } } */> {
  protected readonly ownerRole: string = 'OWNER'; // 도메인이 오버라이드

  abstract canCreate(actor: AuthSubject, ctx: { teamId: number }): boolean;
  abstract canRead(actor: AuthSubject, resource: TEntity): boolean;
  abstract canUpdate(actor: AuthSubject, resource: TEntity): boolean;
  abstract canDelete(actor: AuthSubject, resource: TEntity): boolean;

  authorize(actor, action: ActionLike, resource): void; // CRUD 매핑 + 커스텀 액션 default-deny. SUPER bypass
  authorizeCreate(actor, ctx: { teamId: number }): void;
  protected isTeamMember/isTeamOwner(actor, resource): boolean;
}

// 로드+인가를 묶는 안전 경로(인스턴스 IDOR 방지)
loadAndAuthorize(loader, policy, actor, action, id): Promise<TEntity>;
```

### identity 레퍼런스 정책 (`modules/identity/access/user.resource-policy.ts`)

```ts
@Injectable()
export class UserResourcePolicy extends ResourcePolicy<User> {
  protected override readonly ownerRole = TeamPosition.LEADER;

  canCreate(actor, { teamId }) {
    return this.membership(actor, teamId)?.role === this.ownerRole;
  } // 대상 팀 팀장만
  canRead(actor, user) {
    return this.isTeamMember(actor, user);
  } // 같은 소속팀
  canUpdate(actor, user) {
    return this.isTeamOwner(actor, user) || this.isSelf(actor, user);
  } // 팀장 or 본인
  canDelete(actor, user) {
    return this.isTeamOwner(actor, user) && !this.isSelf(actor, user);
  } // 팀장, 본인 제외
  authorizeChangeRole(actor, user); // 직위 변경: 팀장만·본인 제외(self-escalation 차단)
}
```

```ts
// user.service.ts — 로드+인가를 loadAndAuthorize로 묶는다
async getUser(actor: AuthSubject, id: number): Promise<UserData> {
  try {
    const user = await loadAndAuthorize((uid) => this.getUserOrThrow(uid), this.policy, actor, Action.READ, id);
    return this.toData(user);
  } catch (e) {
    // cross-team read는 403이 아니라 NOT_FOUND로 마스킹(403/404 존재 오라클 제거)
    if (e instanceof ForbiddenException) throw USER_EXCEPTIONS.NOT_FOUND();
    throw e;
  }
}
```

목록은 service에서 actor의 소속팀(들)으로 스코프한다(SUPER는 전체) — cross-team 정보 노출 방지.

## 스타터 엔진 vs 도메인 구현

| 엔진 `src/lib/access-control/`                                | 도메인 레퍼런스 `src/modules/identity/`, `auth/`         |
| ------------------------------------------------------------- | -------------------------------------------------------- |
| `Action`/`ActionLike`, `GlobalRole`(SUPER)                    | `Role`(capability), `Team`(소유 단위), `TeamPosition`    |
| `AuthSubject`/`TeamMembership` 타입                           | `IDENTITY_ROLE_MATRIX`(역할×액션) + `resolveAccessRoles` |
| `@Requires`/`@Public`/`@CurrentUser`, `PolicyGuard`           | `ACCESS_POLICY_PROVIDER` 바인딩(app.module)              |
| `AccessPolicyProvider`/`StaticAccessPolicyProvider`           | `UserResourcePolicy`(소유권 정책)                        |
| `ResourcePolicy<TEntity>` + `TeamScoped` + `loadAndAuthorize` | 토큰 발급/refresh/blocklist(로그인·로그아웃)             |
| `AuthGuard`(인증+blocklist)                                   | `users`/`teams` 테이블 + `team_id`/`role_id` FK          |

## 새 엔드포인트 체크리스트

1. 인증 불필요(로그인/health) → `@Public()`.
2. 보호 라우트 → **반드시** `@Requires(Action.X, 'resourceType')`. 생략 시 default-deny로 거부.
3. 매트릭스에 `(역할, resourceType, action)`을 등록(없으면 SUPER만 통과).
4. 인스턴스 라우트(`:id`)는 service에서 엔티티 로드 후 `loadAndAuthorize(...)`(또는 `policy.authorize`) 호출 — IDOR 방지.
5. 도메인 리소스가 소유 단위를 가지면 `team` 관계(`TeamScoped`)를 만족시킨다.

## 현행 대비 마이그레이션 (Breaking, 옛 `@Roles` → 현재)

| 이전                                   | 이후                                                            |
| -------------------------------------- | --------------------------------------------------------------- |
| `AuthSubject.roles: RoleCode[]` (전역) | `globalRoles[]` + `teams[{teamId, role}]` + `role`(capability)  |
| `@Roles(RoleCode.ADMIN)`               | `@Requires(Action.UPDATE, 'resource')`                          |
| `RolesGuard` ("역할 하나라도 일치")    | `PolicyGuard` (역할×액션 매트릭스)                              |
| `RoleCode`(USER/ADMIN/SUPER)           | `GlobalRole`(SUPER) + `Role`(capability) + `TeamPosition`(직위) |
| **default-allow** (@Roles 없으면 통과) | **default-deny** (@Requires/@Public 없으면 거부)                |

## 보안 주의사항 (필수 — 도메인 구현 시)

엔진의 default-deny 코어는 견고하지만, **신뢰 경계와 Tier2 적용은 도메인 구현자가 지켜야** 안전하다.

1. **발급자 계약 (가장 중요)** — `teams`/`globalRoles`/`role`은 JWT claim이고 엔진은 무조건 신뢰한다. 토큰 발급자(로그인)는 이 값을 **반드시 서버 측 DB 상태에서만** 채운다. 클라이언트 입력(가입 body의 role 등)을 토큰/엔티티에 복사하면 즉시 권한 상승이다. identity는 `CreateUserRequest`에 `globalRoles`/`role` 필드를 두지 않고 `User.create`가 `globalRoles`를 항상 `[]`로 만들어 이를 차단한다. `SUPER`는 전체 bypass이므로 **보호된 관리자 출처에서만** 부여한다.
2. **인스턴스 라우트(`:id`)는 Tier2 필수** — Tier1은 capability 등급만 본다. 대상 리소스가 actor 소유인지는 보지 않으므로, `:id` 라우트는 **반드시** service에서 `loadAndAuthorize(...)`를 호출한다. 빠뜨리면 cross-team IDOR가 가능하다. read 인가 실패는 NOT_FOUND로 마스킹해 존재 오라클을 막는다.
3. **시크릿 하드닝** — `JWT_SECRET`·`REFRESH_TOKEN_SECRET`·`SESSION_SECRET`은 prod/stage에서 약한값/기본값/AT=RT 동일이 부팅 거부된다(`env.schema.ts`). HS256 대칭키라 인가 모델 전체가 시크릿 무결성에 달려 있다 — crown jewel로 관리.
4. **blocklist는 fail-open** — Redis 장애 시 강제 로그아웃이 무력화된다. access token TTL을 짧게(15분) 유지한다. 즉시 무효화가 critical하면 `REDIS_REQUIRED=true` + fail-closed 검토.
5. **`jti` 필수** — `jti` 없는 토큰은 무효화 불가 → `AuthGuard`가 **거부**한다. 발급자는 모든 토큰에 `jti`를 넣는다.
6. **가드는 HTTP 전용** — `AuthGuard`/`PolicyGuard`는 non-http에서 통과한다. WebSocket/microservice 도입 시 전용 가드를 붙인다.
7. **레이트리밋** — `ThrottlerGuard`가 전역(60s/100req), 인증 라우트는 `@Throttle`로 더 조인다(login 5/분). brute-force/credential-stuffing 방어.

## 향후 확장

- **DB 오버레이**: 역할×액션 매트릭스를 런타임 편집하려면 `AccessPolicyProvider`를 DB 구현으로 교체(코드 기본 + DB 오버레이).
- **명시적 deny / 조건(Condition)**: IAM처럼 `effect: deny` 우선순위나 시간/IP/속성 조건이 필요하면 `AccessPolicyProvider`/매트릭스를 statement 모델로 확장.
- **비대칭 서명(RS/ES)**: 검증자가 발급키를 갖지 않도록 AT를 비대칭으로 전환(현재 `JWT_ALGORITHM` enum은 HMAC 계열).
