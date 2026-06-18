# 접근제어 (RBAC + ABAC)

> **상태: 목표 설계(청사진).** 이 문서는 재설계된 접근제어 모델을 기술한다. 엔진(`src/lib/access-control/`)
> 구현이 이 문서를 기준으로 진행된다. 이전의 단순 `@Roles` RBAC는 이 모델로 대체된다(맨 아래 마이그레이션 참조).

backend-template는 **팀 스코프 RBAC + 리소스 소유권 ABAC**를 default-deny로 제공한다. AWS IAM Role과 유사하게,
"어떤 역할이 어떤 리소스에 어떤 액션을 할 수 있는가"를 명시적으로 선언해야 통과한다. 스타터는 **엔진(데코레이터/가드/베이스/평가기)만** 제공하고, 팀 엔티티·역할 enum·역할×액션 매트릭스는 **도메인**에서 구현한다.

## AI Quick Reference

- **default-deny**: 보호 라우트는 `@Requires(action, resourceType)` 또는 `@Public()`이 **없으면 거부**. 인증만으로 통과하지 않는다.
- **역할은 전역이 아니라 팀별**: `AuthSubject.teams = [{ teamId, role }]`. 전역 운영 역할은 `globalRoles`(예: `SUPER`)로 분리.
- **3-tier**: Tier0 인증(`AuthGuard`+blocklist) → Tier1 RBAC(`PolicyGuard`+`@Requires`, DB 안 침) → Tier2 ABAC(`ResourcePolicy`, 엔티티 소유권).
- **Tier1은 JWT claim만으로 판정** — teamId를 요청에서 뽑아 `teams` claim의 역할 → 역할×액션 매트릭스. DB 호출 없음.
- **Tier2는 엔티티 로드 후** service에서 `policy.authorize(actor, action, entity)`. 소유권/테넌트처럼 DB가 필요한 규칙 전용.
- **`SUPER`(globalRoles)는 전체 bypass** (IAM root). PolicyGuard에서 즉시 통과.
- **스타터=엔진만**. Team/TeamMember 엔티티, 팀 역할 enum, 매트릭스, 리소스별 정책은 도메인.
- 액션: `create / read / update / delete / manage(=*)` + 커스텀 문자열(`order:cancel`).

## 모델 개요 (3-Tier)

| Tier       | 위치                                                    | 질문                                            | DB                | 실패 시 |
| ---------- | ------------------------------------------------------- | ----------------------------------------------- | ----------------- | ------- |
| **0 인증** | `AuthGuard` (`src/core/auth/`)                          | 토큰이 유효하고 강제로그아웃되지 않았나?        | Redis (blocklist) | 401     |
| **1 RBAC** | `PolicyGuard` + `@Requires` (`src/lib/access-control/`) | 이 팀에서 이 역할이 이 액션을 할 수 있나?       | 없음 (JWT claim)  | 403     |
| **2 ABAC** | `ResourcePolicy<TEntity>` (service에서 호출)            | 이 리소스가 그 팀 소유이고 actor가 권한이 있나? | 엔티티 로드       | 403     |

가드 등록 순서(APP_GUARD): `AuthGuard`(인증) → `PolicyGuard`(인가). Tier2는 가드가 아니라 service 내부에서 호출한다(엔티티를 로드해야 하므로).

## 인증 주체 (AuthSubject) & JWT

`AuthGuard`가 토큰 검증 후 `request.user`에 주입한다.

```ts
interface TeamMembership {
  teamId: number;
  role: string; // 팀 역할. 구체 enum(OWNER/MANAGER/MEMBER 등)은 도메인에서 정의
}

interface AuthSubject {
  id: string | number; // JWT sub
  jti: string; // 강제 로그아웃 blocklist 키
  globalRoles: GlobalRole[]; // 플랫폼 운영 역할 (SUPER = 전체 bypass)
  teams: TeamMembership[]; // 팀별 역할
  [key: string]: unknown; // tenantId 등 도메인 확장
}
```

JWT 페이로드 예시(발급은 도메인 로그인 단계):

```jsonc
{
  "sub": 42,
  "jti": "abc-123",
  "globalRoles": [],
  "teams": [
    { "teamId": 1, "role": "OWNER" },
    { "teamId": 3, "role": "MEMBER" },
  ],
  "exp": 1717891200,
}
```

토큰 정책(도메인 구현, 참고): Access 15분(가드에서 디코드, DB 안 침) / Refresh 7일(Redis) / 강제 로그아웃은 Redis blocklist(`blocked:{jti}`, TTL = access TTL).

## Tier 0 — 인증 (`AuthGuard` + blocklist)

`AuthGuard`는 ① `@Public()`이면 스킵 ② `Authorization: Bearer` JWT 서명 검증 ③ **`blocked:{jti}` Redis 조회 — 존재하면 401**(강제 로그아웃) ④ `AuthSubject` 주입. 토큰 발급/리프레시/blocklist 등록(로그아웃)은 도메인 단계에서 구현한다.

## Tier 1 — RBAC (`@Requires` + `PolicyGuard`, DB 안 침)

```ts
import { Requires, Action } from '@/lib/access-control';

@Requires(Action.UPDATE, 'scenario')
@Patch(':teamId/scenarios/:id')
update() {}
```

`PolicyGuard` 판정 순서:

1. `@Public()`이면 통과(인증 자체 스킵).
2. `@Requires`가 **없으면 거부**(default-deny). 인증만으로는 통과하지 않는다.
3. `actor.globalRoles`에 `SUPER`가 있으면 **즉시 통과**(IAM root bypass).
4. 요청에서 **teamId 추출**(기본 `request.params.teamId`, 데코레이터 옵션으로 추출자 교체 가능).
5. `actor.teams`에서 그 팀의 역할을 찾는다. 없으면 거부.
6. **역할×액션 매트릭스**(`AccessPolicyProvider`)로 `(role, action, resourceType)` 허용 여부 판정.

```ts
// 액션 (스타터 제공). 커스텀 문자열도 허용: 'order:cancel'
enum Action {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  MANAGE = 'manage',
}
// MANAGE = 와일드카드('*'): 모든 액션 허용

// 매트릭스 공급자: 스타터는 인터페이스 + 코드 기본 구현 제공. 도메인이 DB 오버레이로 교체 가능.
interface AccessPolicyProvider {
  can(role: string, action: Action | string, resourceType: string): boolean;
}
```

> 매트릭스(예: `OWNER → CRUD`, `MANAGER → CRU`, `MEMBER → R`)는 **도메인**이 정의한다. 코드 상수로 시작하고, 런타임 커스텀이 필요하면 `AccessPolicyProvider`를 DB 구현으로 교체한다(코드 기본 + DB 오버레이).

## Tier 2 — ABAC (`ResourcePolicy<TEntity>`, 엔티티 소유권)

Tier1은 "역할이 액션을 할 수 있나"만 본다. "이 **특정 리소스**가 그 팀 소유인가, actor가 그 리소스에 권한이 있나"는 엔티티를 로드해야 알 수 있으므로 **service에서** 판정한다.

```ts
import { ResourcePolicy, TeamScoped, AuthSubject, Action } from '@/lib/access-control';

interface TeamScoped {
  team: { id: number };
} // 팀 소유 리소스가 만족해야 하는 형태

abstract class ResourcePolicy<TEntity extends TeamScoped> {
  abstract canCreate(actor: AuthSubject, ctx: { teamId: number }): boolean;
  abstract canRead(actor: AuthSubject, resource: TEntity): boolean;
  abstract canUpdate(actor: AuthSubject, resource: TEntity): boolean;
  abstract canDelete(actor: AuthSubject, resource: TEntity): boolean;

  /** 엔티티 로드 후 호출. 실패 시 ForbiddenException. */
  authorize(actor: AuthSubject, action: Action, resource: TEntity): void;

  protected isTeamMember(actor: AuthSubject, resource: TEntity): boolean;
  protected isTeamOwner(actor: AuthSubject, resource: TEntity): boolean;
}
```

도메인 사용 예:

```ts
// scenario.policy.ts (도메인)
@Injectable()
export class ScenarioPolicy extends ResourcePolicy<TrainingScenario> {
  canUpdate(actor, resource) { return this.isTeamOwner(actor, resource); }
  canRead(actor, resource)   { return this.isTeamMember(actor, resource); }
  // ...
}

// scenario.service.ts
async update(actor: AuthSubject, id: number, dto: UpdateScenarioRequest) {
  const scenario = await this.repo.getById(id);        // 엔티티 로드
  this.policy.authorize(actor, Action.UPDATE, scenario); // Tier2: 소유권 검사
  // ... 수정
}
```

## 스타터 vs 도메인 책임

| 스타터 `src/lib/access-control/`                       | 도메인 (`src/modules/`)                             |
| ------------------------------------------------------ | --------------------------------------------------- |
| `Action`, `GlobalRole`(SUPER bypass)                   | `Team`/`TeamMember` 엔티티                          |
| `AuthSubject`/`TeamMembership` 타입                    | 팀 역할 enum(OWNER/MANAGER/MEMBER)                  |
| `@Requires`, `@Public`, `@CurrentUser`, `PolicyGuard`  | 역할×액션 매트릭스(코드 상수 또는 DB)               |
| `AccessPolicyProvider` 인터페이스 + 기본 구현          | 리소스별 `ResourcePolicy` 서브클래스                |
| `ResourcePolicy<TEntity>` 베이스 + `TeamScoped` + 헬퍼 | 토큰 발급/리프레시, blocklist 등록(로그인/로그아웃) |
| `AuthGuard`(인증 + blocklist 체크)                     | `team_members`/리소스 `team_id` FK 스키마           |

## 새 엔드포인트 체크리스트

1. 인증 불필요(회원가입/로그인/health) → `@Public()`.
2. 보호 라우트 → **반드시** `@Requires(Action.X, 'resourceType')`. 생략하면 default-deny로 거부된다.
3. 라우트에 teamId가 있어야 Tier1이 동작한다(기본 `:teamId` param). 다른 위치면 `@Requires`에 추출자 지정.
4. 소유권/인스턴스 규칙이 있으면 service에서 엔티티 로드 후 `policy.authorize(actor, action, entity)` 호출.
5. 도메인 리소스는 `team_id` FK + `TeamScoped` 형태를 만족시킨다.

## 현행 대비 마이그레이션 (Breaking)

| 이전                                   | 이후                                             |
| -------------------------------------- | ------------------------------------------------ |
| `AuthSubject.roles: RoleCode[]` (전역) | `globalRoles[]` + `teams[{teamId, role}]`        |
| `@Roles(RoleCode.ADMIN)`               | `@Requires(Action.UPDATE, 'resource')`           |
| `RolesGuard` ("역할 하나라도 일치")    | `PolicyGuard` (팀역할×액션 매트릭스)             |
| `RoleCode`(USER/ADMIN/SUPER)           | `GlobalRole`(SUPER 등) + 팀역할(도메인)          |
| **default-allow** (@Roles 없으면 통과) | **default-deny** (@Requires/@Public 없으면 거부) |

- `06` 외에 동기화 필요 문서: `CLAUDE.md`(핵심 원칙 #5), `12-api-design.md`(상태코드/접근제어 언급), `01-project-structure.md`(인증 데코레이터 목록). 엔진 구현과 함께 갱신한다.

## 보안 주의사항 (필수 — 도메인 구현 시)

이 엔진의 default-deny 코어(Tier1)는 견고하지만, **신뢰 경계와 Tier2 적용은 도메인 구현자가 지켜야** 안전하다. 아래는 빠뜨리면 인가 우회로 직결되는 항목이다.

1. **발급자 계약 (가장 중요)** — `teams`/`globalRoles`는 JWT claim(자기주장)이고 엔진은 이를 **무조건 신뢰**한다. 토큰 발급자(로그인)는 이 값을 **반드시 서버 측 DB 상태에서만** 채운다. 클라이언트 입력(회원가입 body의 role 등)을 토큰에 복사하면 즉시 권한 상승이 된다. `SUPER`(globalRoles)는 전체 bypass이므로 **보호된 관리자 출처에서만** 부여한다. 가장 파괴적인 작업은 `SUPER` claim을 DB로 한 번 더 검증하는 것을 권장.
2. **인스턴스 라우트(`:id`)는 Tier2 필수** — Tier1은 "이 팀에서 이 역할이 이 액션 가능"만 본다. 대상 리소스가 **실제로 그 팀 소유인지**는 보지 않는다. 따라서 `:id`로 엔티티를 로드하는 라우트는 **반드시** service에서 `policy.authorize(actor, action, entity)`(또는 `loadAndAuthorize(...)`)를 호출해야 한다. 빠뜨리면 자신이 멤버인 teamId만 넣어 타 팀 리소스를 건드리는 cross-team IDOR가 가능하다. `loadAndAuthorize` 헬퍼로 "로드+인가"를 묶어 안전 경로를 기본화한다.
3. **blocklist는 fail-open** — Redis 장애 시 강제 로그아웃이 무력화되고, 토큰은 자연 만료까지 유효하다. 따라서 **access token TTL을 짧게**(15분 권장) 유지한다. `JWT_EXPIRES_IN` 기본값(`1h`)을 그대로 두면 fail-open 창이 1시간이다. 즉시 무효화가 critical하면 `REDIS_REQUIRED=true` + fail-closed 정책을 검토한다.
4. **`jti` 필수** — `jti`가 없는 토큰은 blocklist로 무효화할 수 없다(강제 로그아웃 불가). 발급자는 모든 토큰에 `jti`를 넣는다. 엔진은 `jti` 없는 토큰 수락 시 경고 로그를 남긴다.
5. **가드는 HTTP 전용** — `AuthGuard`/`PolicyGuard`는 non-http 컨텍스트에서 통과(`return true`)한다. WebSocket/microservice 등 다른 transport를 도입하면 전용 가드를 따로 붙여야 한다(안 그러면 인증·인가 없이 열린다).
6. **`APP_ENV`를 모든 배포에 명시** — 시크릿 하드닝 게이트(약한 `JWT_SECRET` 차단)는 `APP_ENV=prod|stage`에서만 작동한다. 기본값이 `dev`라 미설정 시 알려진 기본 시크릿으로 떠 토큰 위조가 가능하다.

## 향후 확장

- **DB 오버레이**: 역할×액션 매트릭스를 런타임 편집(관리자가 역할 정의)하려면 `AccessPolicyProvider`를 DB 구현으로 교체한다.
- **명시적 deny**: IAM처럼 statement에 `effect: deny`를 도입해 "명시적 deny > allow" 우선순위가 필요해지면 `AccessPolicyProvider`/매트릭스를 statement 모델로 확장한다.
- **조건(Condition)**: 시간/IP/속성 기반 조건이 필요하면 Tier1 매트릭스 또는 Tier2 정책에 조건 평가를 추가한다.
