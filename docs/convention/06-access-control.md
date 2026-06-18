# 접근제어 (RBAC)

backend-template는 **코드 기반 역할 접근제어(RBAC)**를 기본 골격으로 제공한다. 역할은 DB가 아닌 코드(enum)로 정의하고, 라우트 단위로 허용 역할을 선언한다. 구현은 `src/lib/access-control/`에 있다.

## 구성 요소

| 파일                                          | 역할                                                                |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `src/lib/access-control/role-code.enum.ts`    | `RoleCode` enum (USER/ADMIN/SUPER) + `ROLE_RANK` 위계               |
| `src/lib/access-control/roles.decorator.ts`   | `@Roles(...)` 데코레이터, `ROLES_KEY`                               |
| `src/lib/access-control/roles.guard.ts`       | `RolesGuard` — `@Roles` 메타데이터 기반 인가                        |
| `src/lib/access-control/auth-subject.type.ts` | `AuthSubject` — 인증된 주체(principal) 인터페이스                   |
| `src/core/auth/auth.guard.ts`                 | 전역 `AuthGuard` — 인증(세션/JWT) 검증 후 `request.user` 주입       |
| `src/common/decorators/auth-public.decorator.ts` | `@Public()` — 인증/인가 스킵                                     |
| `src/lib/access-control/index.ts`             | 위 심볼들의 배럴 export (`@/lib/access-control`)                    |

## 역할 코드

`RoleCode`는 제네릭 샘플 값을 제공한다. 프로젝트 도메인에 맞게 값을 교체/확장한다.

```typescript
export enum RoleCode {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER = 'SUPER',
}

// 위계(높을수록 강함). "이상" 비교가 필요하면 사용한다.
export const ROLE_RANK: Record<RoleCode, number> = {
  [RoleCode.USER]: 0,
  [RoleCode.ADMIN]: 10,
  [RoleCode.SUPER]: 20,
};
```

## 가드 동작

두 가드가 순서대로 동작한다. **인증 → 인가** 순서를 지킨다.

```typescript
// app.module.ts (예시)
{ provide: APP_GUARD, useClass: AuthGuard },   // 1. 인증: request.user 주입
{ provide: APP_GUARD, useClass: RolesGuard },  // 2. 인가: @Roles 메타데이터 검사
```

`RolesGuard`의 판단 규칙:

- 핸들러/컨트롤러에 `@Roles(...)` 메타데이터가 **없으면 통과**한다 (인증은 AuthGuard가 이미 담당).
- `@Roles(...)`가 있으면 `request.user.roles`에 허용 역할이 **하나라도** 있어야 통과한다. 없으면 `403`(ForbiddenException).
- `@Public()`이 붙은 라우트는 AuthGuard 단계에서 인증을 스킵한다.

> 즉 backend-template의 기본값은 "인증된 사용자면 통과, 특정 역할이 필요하면 `@Roles`로 좁힌다"이다. camp-backend의 default-deny `@Permission` 모델과 다르다.

## 인증 주체 (AuthSubject)

AuthGuard가 검증 후 `request.user`에 주입한다. 도메인 단계에서 필드를 확장한다(예: `tenantId`, `profileId`).

```typescript
export interface AuthSubject {
  id: string | number;
  roles: RoleCode[];
  [key: string]: unknown;
}
```

## 컨트롤러 사용법

### 역할 제한이 필요한 엔드포인트

```typescript
import { Roles, RoleCode } from '@/lib/access-control';

@Controller('admin/notes')
export class NoteAdminController {
  @Roles(RoleCode.ADMIN, RoleCode.SUPER) // ADMIN 또는 SUPER만 통과
  @Post()
  create() {}
}
```

### 인증만 필요하고 역할은 무관한 엔드포인트

```typescript
@Controller('notes')
export class NoteController {
  // @Roles 없음 → 로그인된 사용자면 누구나 통과
  @Get('mine')
  getMine() {}
}
```

### 인증 없이 접근 가능한 엔드포인트

```typescript
import { Public } from '@/common/decorators/auth-public.decorator';

@Public() // AuthGuard, RolesGuard 모두 스킵
@Post('signup')
signup() {}
```

## 새 엔드포인트 추가 시 체크리스트

1. 인증이 필요 없는 라우트(회원가입/로그인/health-check)는 `@Public()`을 붙인다.
2. 특정 역할만 허용해야 하면 `@Roles(RoleCode.X, ...)`를 붙인다. 생략하면 인증된 모든 사용자에게 열린다.
3. `@Roles`는 핸들러 또는 컨트롤러 클래스 레벨 어디든 붙일 수 있다(핸들러가 우선).
4. 새 역할이 필요하면 `RoleCode` enum과 `ROLE_RANK`를 함께 갱신한다.

## 향후 확장: ABAC / ResourcePolicy

팀/리소스/소유권 단위의 세밀한 권한(ABAC)이 필요해지면, 역할 기반 RBAC 위에 `ResourcePolicy` 추상을 추가해 확장한다. 예를 들어 "본인 리소스만 수정", "같은 테넌트만 조회" 같은 규칙은:

- 도메인 엔티티 로딩이 필요하므로 가드가 아닌 **Policy 클래스/Service**에서 판단한다 (`05-layer-responsibility.md`의 Policy 분리 참고).
- `src/lib/access-control/`에 `ResourcePolicy` 타입과 평가기를 추가하고, 도메인 모듈에서 정책을 등록한다.

현재 스타터에는 ABAC 구현이 포함되어 있지 않다. RBAC만으로 부족해지는 시점에 도입한다.
