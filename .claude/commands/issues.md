---
name: issues
description: 기술 스펙(.spec.md)을 읽고 Linear에 parent + sub 이슈 그래프를 생성한다.
argument-hint: '<spec_path>'
---

기술 스펙 파일을 기반으로 Linear 이슈를 자동 생성한다.

## 인자

$ARGUMENTS의 첫 번째 토큰을 스펙 파일 경로로 사용한다.

- 경로가 없으면: docs/prd/ 아래 \*.spec.md 파일 목록을 보여주고 선택받는다.
- .spec.md가 아닌 파일이면: 스펙 파일을 지정해주세요. 출력 후 종료.

## 0. 사전 검증

1. 스펙 파일 존재 확인.
2. frontmatter에서 type (feature | enabler) 추출.
3. Linear MCP 사용 가능 여부 확인 (list_teams 호출).
4. team이 여러 개면 사용자에게 선택받는다.

**Linear 설정**: .claude/config.json (키: linear.teamId, linear.workspace). 없으면 사용자에게 확인.
프로젝트별 설정: .claude/config.json (없으면 사용자에게 확인). 실제 ID를 코드에 하드코딩하지 않는다.

## 1. 스펙 파싱

### 1.1 공통 추출

- 요약, 결정 사항, 열린 질문, 검증 조건, 구현 순서

### 1.2 설계 섹션 추출 (type 분기)

Feature: 데이터 → Data Layer sub, 서비스 → Service Layer sub, API → API Layer sub
Enabler: 컴포넌트 섹션에서 실제 기술된 컴포넌트만 sub 생성

## 2. 검증 조건 → 테스트 완료 조건 분배

### 2.1 Feature 분배 규칙

| 레이어  | 테스트 타입 | 매핑 기준                     |
| ------- | ----------- | ----------------------------- |
| Data    | 단위        | 엔티티 상태 전이, 필드 검증   |
| Data    | 통합        | repository 쿼리, FK 정합성    |
| Service | 단위        | 비즈니스 규칙, 이벤트 발행    |
| Service | 통합        | 트랜잭션 원자성               |
| API     | e2e         | endpoint 요청/응답, 인증/인가 |

### 2.2 Enabler 분배 규칙

핵심 모듈 → 단위, 어댑터 → 통합, 데코레이터/유틸 → 단위, 기존 코드 적용 → e2e

### 2.3 분배 원칙

- 하나의 검증 조건 → 최소 1개 테스트.
- 엣지 케이스는 해당 로직이 있는 레이어/컴포넌트에 배치.
- e2e는 사용자 흐름 전체를 검증하는 조건만.
- 매핑이 애매한 조건은 배치 확인 필요 표시하고 사용자에게 묻는다.

## 3. 이슈 본문 구성

Parent: 요약, 결정 사항, 검증 조건(통과/엣지), 열린 질문, 구현 순서
Sub (Feature): 작업 범위, 완료 조건(단위/통합), 구현 순서
API Layer sub에만: e2e 테스트 섹션 추가
Sub (Enabler): 작업 범위, 완료 조건, 구현 순서

## 4. 프리뷰 + 확인

push 전에 전체 구조 보여준다. ㅇㅇ/ㄱㄱ → push, edit → 수정 후 재프리뷰

## 5. Linear Push

제목 포맷:
| Parent Feature | [BE] {title} |
| Sub Data | [BE] {title} — Data Layer |
| Sub Service | [BE] {title} — Service Layer |
| Sub API | [BE] {title} — API Layer |
| Parent Enabler | [BE] {title} |
| Sub Enabler | [BE] {title} — {component_name} |

순서: Parent → sub들 (parentId 연결) → 구현 순서에 ID 역채움

## 6. 결과

Push 완료 후 트리 구조로 출력. 커버리지: N/N (100%)

## 규칙

- 검증 조건이 비어있으면 경고 후 확인받고 진행.
- 검증 제외 항목은 parent에 검증 제외 섹션으로 기록.
- sub 이슈는 완료 조건에 집중. 이슈 제목은 한국어 자연어 위주.
