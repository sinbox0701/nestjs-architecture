---
name: fe-changes
description: BE 변경이 FE(Orval 코드젠)에 미치는 영향을 카테고리별 테이블로 분석한다.
argument-hint: '[base-branch]'
---

현재 브랜치의 BE 변경이 FE에 미치는 영향을 분석하여 카테고리별 테이블로 출력한다.

## 인자

- branch 이름이 주어지면 해당 branch 대비 diff 분석.
- 인자가 없으면 main 대비.

## FE/Orval 설정

FE 레포 경로와 Orval 실행 커맨드는 프로젝트마다 다르다.
.claude/config.json (키: frontend.repoPath, frontend.orvalCommand, 기본값 pnpm orval) 에서 읽는다.
없으면 사용자에게 확인. 실제 경로를 코드에 하드코딩하지 않는다.

## 1. 변경 파일 수집

git diff <base-branch>...HEAD --name-only

| 분류           | 파일 패턴                                     |
| -------------- | --------------------------------------------- |
| Controller     | _.controller.ts, _.admin.controller.ts        |
| DTO            | _.dto.ts, _.request.ts, \*.response.ts        |
| Entity         | \*.entity.ts                                  |
| Enum/Type      | _.enum.ts, _.type.ts, \*.constant.ts          |
| Exception      | _.exception.ts, exception/_.ts                |
| Event          | _.event.ts, _.handler.ts (SSE/WebSocket 관련) |
| Access Control | _.matrix.ts, _.resource-policy.ts, access/\_  |

## 2. 카테고리별 분석

### 2.1 API Endpoint 변경

controller diff에서 route decorator + method 추가/수정/삭제 파악. DTO 역추적.

### 2.2 DTO/Schema 변경

필드 추가/삭제/타입 변경 파악. DTO 클래스명 변경은 Breaking.

### 2.3 Enum 변경

enum 값 추가/삭제/변경. 영향 endpoint 특정.

### 2.4 에러 코드 변경

에러 코드 문자열/HTTP 상태/메시지 변경, 신규/삭제.

### 2.5 응답 래퍼 변경

R.data ↔ R.list ↔ R.page ↔ R.cursorPage 변경, 페이지네이션 구조 변경.

### 2.6 권한/인가 변경

- `@Requires(Action.X, '<resourceType>')` 데코레이터 추가/변경/삭제 (Tier1 RBAC)
- `@Public()` 추가/제거 (인증 요구 토글)
- capability 매트릭스(`access/*.matrix.ts`) 또는 `ResourcePolicy`(`access/*.resource-policy.ts`) 소유권 규칙 변경 (Tier2 ABAC)
- 참고: 인가 변경은 Orval 타입을 바꾸지 않는다(런타임 403/401) — FE는 호출 가능 여부·에러 핸들링 관점에서 영향받음.

### 2.7 실시간 이벤트 변경 (해당 시)

SSE/WebSocket 관련 파일 변경 시만: 이벤트 타입명, payload 구조, 연결/해제 조건.

## 3. Breaking 판정

| Breaking              | Non-breaking       |
| --------------------- | ------------------ |
| 필드 삭제             | optional 필드 추가 |
| 필드 타입 변경        | 새 endpoint 추가   |
| DTO 클래스명 변경     | 새 enum 값 추가    |
| enum 값 삭제/변경     | 새 에러 코드 추가  |
| 에러 코드 문자열 변경 |                    |
| 응답 래퍼 변경        |                    |
| HTTP 상태 코드 변경   |                    |
| @Public() 제거        | @Public() 추가     |

## 4. 출력

Breaking: N건 / Non-breaking: M건

테이블: API Endpoint, Enum, 에러 코드, 응답 래퍼, 권한, 실시간 이벤트 (변경 있는 것만)

Breaking 1건 이상: FE 작업 필요 체크리스트 + Orval 재생성 안내
Breaking 0건: Orval 재생성 안내 (frontend.orvalCommand, 기본 pnpm orval)

## 규칙

- 변경 없는 카테고리는 출력하지 않는다.
- Breaking 항목은 ⚠️ 로 표시.
- DTO 클래스명은 Orval 타입명과 동일하므로 정확히 기재.
- 에러 코드 문자열 변경은 반드시 Breaking.
