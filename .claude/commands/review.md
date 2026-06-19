---
name: review
description: 프로젝트 코드를 docs/convention/ 기준으로 리뷰하고, 스펙/이슈가 있으면 구현 정합성도 검증한다.
argument-hint: '[모듈명 또는 파일 경로 또는 Linear 이슈 ID (예: BE-302)]'
---

프로젝트 코드 리뷰를 수행한다. 컨벤션 위반 + 비효율 코드를 찾고, 스펙/이슈가 있으면 구현 정합성도 검증한다.

## 인자 해석

| 입력                    | 모드        | 기준                                  |
| ----------------------- | ----------- | ------------------------------------- |
| BE-302 (Linear 이슈 ID) | 이슈 모드   | convention + 이슈 작업 범위/완료 조건 |
| docs/prd/xxx.spec.md    | 스펙 모드   | convention + 스펙 설계/검증 조건      |
| order 또는 파일 경로    | 컨벤션 모드 | convention만                          |
| (없음)                  | 컨벤션 모드 | convention만, 전체 모듈               |

## 준비

1. docs/convention/ 아래 모든 컨벤션 문서(00~10, 02 제외)를 읽는다.
2. 이슈 모드: Linear MCP로 이슈를 읽어 작업 범위, 완료 조건 파악.
3. 스펙 모드: 스펙 파일을 읽어 설계 섹션과 검증 조건 파악.
4. 컨벤션 모드: 모듈/파일 특정 또는 src/modules/ 전체.

## 리뷰 체크리스트

### 1. 네이밍 (06-naming-and-style.md)

- 파일명: 도메인명 + 역할 (order.service.ts)
- DTO 클래스명: 행위+대상+Request/Response (CreateOrderRequest)
- nested 응답 DTO: 대상+Data/ItemData/SummaryData/DetailData
- 메서드명: getBy...(없으면 예외) vs findBy...(없으면 null)
- import 순서: 외부 패키지 → @/ alias → 상대 경로
- MikroORM 데코레이터: @mikro-orm/decorators/legacy, 타입: @mikro-orm/core

### 2. 레이어 책임 (04-layer-responsibility.md)

Controller: 비즈니스 로직 없음, R.data/R.list/R.page/R.cursorPage/R.empty 사용
Service: 유스케이스 진입점, orchestration은 service에서
Repository: 다른 도메인 repo 직접 주입 금지, 페이지네이션 쿼리 시점 적용
Entity: create() 팩토리, update()/changeStatus() 캡슐화
Exception: 인라인 예외 생성 금지, 예외 팩토리 상수 사용

### 3. 모듈 구조 (02-module-rules.md, 03-module-patterns.md)

- 순환 참조/forwardRef 없는가
- 동기(imports/exports) vs 비동기(이벤트) 선택 기준 준수

### 4. MikroORM 관계 처리

- unwrap() 습관적 사용 금지 (PK만 필요하면 ref.id)
- load() 반복문/entity메서드/DTO생성자에서 사용 금지
- QueryBuilder: applyFilters() 호출 또는 deletedAt 조건 직접 추가

### 5. 접근제어 (05-access-control.md)

- 모든 엔드포인트에 @Roles(RoleCode.X) (src/lib/access-control 에서 import) 또는 @Public() 적용
- @Roles() 없는 인증 필요 라우트: 글로벌 RolesGuard가 인증은 강제하지만 역할 제한 없음
- @Public() (src/common/decorators/auth-public.decorator.ts): 비인증 허용
- RoleCode: USER / ADMIN / SUPER

### 6. 로깅

- 쓰기 작업 서비스에 FrameworkLogger 있는가

### 7. 비효율 코드

- N+1 쿼리, 불필요한 em.flush(), 중복 로직, 사용되지 않는 import/변수

## 출력 형식

모듈별로 발견된 이슈를 정리한다. 이슈가 없는 모듈은 생략한다.

## [모듈명]

### 컨벤션 위반

- **[HIGH/MEDIUM/LOW]** [파일:라인] 설명

### 비효율 코드

- **[HIGH/MEDIUM/LOW]** [파일:라인] 설명 → 개선 제안

심각도:

- HIGH: 런타임 버그 가능성, N+1, 레이어 책임 위반, 인라인 예외
- MEDIUM: 네이밍 위반, DTO 패턴 불일치, 접근제어 누락
- LOW: import 순서, 메서드 순서, 로깅 누락

### 8. 스펙/이슈 정합성 (이슈 모드 또는 스펙 모드일 때만)

- 결정 사항 반영 확인
- 설계 일치 확인 (Feature: 데이터/서비스/API, Enabler: 컴포넌트 구조)
- 완료 조건 구현 확인
- 열린 질문 확인

이슈/스펙 모드 추가 출력:

### 스펙 정합성

- **[반영됨]** 결정 사항 N건 중 N건 구현
- **완료 조건 커버리지**: N/M건 구현

마지막에 전체 요약:

1. HIGH 이슈 총 개수와 우선 수정 대상
2. 반복적으로 나타나는 패턴
3. 모듈별 건강도 한줄 평가
4. (이슈/스펙 모드) 스펙 정합성 요약
