---
name: spec
description: PRD 파일을 읽고 deep-dive 분석을 거쳐 기술 스펙을 생성한다.
argument-hint: '<prd_path>'
---

PRD 파일을 기반으로 기술 스펙을 생성한다.

## 인자

$ARGUMENTS의 첫 번째 토큰을 PRD 파일 경로로 사용한다.

- 경로가 없으면: docs/prd/ 아래 .md 파일 목록을 보여주고 선택받는다 (\_template.md, \_spec-template.md 제외).
- 경로가 \_template.md이면: PRD를 먼저 작성해주세요. 출력 후 종료.

## 0. 사전 검증

1. PRD 파일이 존재하는지 확인.
2. frontmatter에서 type (feature | enabler) 추출. 없으면 사용자에게 묻는다.
3. docs/prd/\_spec-template.md 존재 확인.
4. 이미 같은 이름의 .spec.md가 존재하면 덮어쓸지 묻는다.

## 1. 컨텍스트 수집

### 1.1 PRD 읽기

PRD의 모든 섹션(문제, 시나리오, 제약, 범위 밖, 모르는 것)을 파싱한다.

### 1.2 코드베이스 탐색

PRD의 시나리오와 제약을 기반으로 관련 코드를 탐색한다:

- Feature: 관련 엔티티, 서비스, 컨트롤러, 기존 모듈 구조
- Enabler: 적용 대상 모듈, 기존 유사 패턴, 환경 변수 설정

탐색 범위:

- src/modules/ — 관련 도메인 모듈의 실제 코드 (entity, service, controller)
- src/modules/_/_.module.ts — 실제 imports/exports로 모듈 의존성 파악
- src/lib/ — 공통 인프라 (Enabler인 경우)

실제 의존성은 코드의 import/module 정의를 직접 확인한다.

### 1.3 컨벤션 확인

작업 범위에 해당하는 docs/convention/ 문서를 읽어서 설계 제약을 파악한다.

## 2. 인터뷰 (대화형)

PRD의 모르는 것과 코드 탐색에서 발견된 모호한 점을 해소한다.

### 질문 원칙

- 한 번에 1~2개 질문. 한꺼번에 쏟아붓지 않는다.
- 코드에서 답을 찾을 수 있는 건 묻지 않고 직접 확인한다.
- Feature: 사용자 흐름 분기, 예외 상황, 권한 경계, 다른 모듈 영향
- Enabler: 적용 범위, breaking change, 환경별 차이, 사용 패턴

### 종료 조건

- 스펙 템플릿의 필수 섹션을 채울 수 있을 만큼 정보가 충분할 때
- 사용자가 충분해, 넘어가자, ㄱㄱ 등으로 진행을 요청할 때
- 5라운드 이상 진행 시 현재까지의 정보로 초안을 먼저 보여준다

## 3. 스펙 생성

docs/prd/\_spec-template.md를 기반으로 스펙을 생성한다.

### 3.1 공통 섹션

- 요약: PRD 문제/시나리오 1~2문장 압축.
- 결정 사항: 인터뷰에서 확정된 기술 판단 + 근거.
- 열린 질문: 인터뷰로 해소되지 않은 것.

### 3.2 설계 섹션 (type 분기)

Feature:

- 데이터: 엔티티, 관계, 새 컬럼, migration 필요 여부
- 서비스: 핵심 비즈니스 로직, 트랜잭션 경계, 이벤트
- API: endpoint, 인증/인가, request/response 개요

Enabler:

- 도입 기술, 컴포넌트, 적용 대상, 환경 변수, 사용 가이드

### 3.3 검증 조건

통과 케이스:

- PRD 시나리오의 각 항목이 최소 1개 통과 케이스에 대응
- ~하면 ~된다 형식으로, it(should ...) 에 직접 매핑 가능하게

엣지 케이스:

- PRD 제약의 각 항목에서 경계값/위반 케이스 도출
- 권한 없음, 동시 요청, null/빈값, 상태 전이 불가 등

### 3.4 구현 순서

- 의존성 기반 순서
- 병렬 가능한 것 명시
- 각 단계가 이슈 1개 단위에 대응할 수 있는 크기

## 4. 출력

PRD 파일명에서 .md를 .spec.md로 바꿔서 같은 디렉토리에 저장:

- docs/prd/order.md → docs/prd/order.spec.md

다음 단계:

- /scaffold <module> 모듈 뼈대 생성
- /test <module> 검증 조건 기반 테스트 작성

## 규칙

- Linear 팀/워크스페이스 설정: .claude/config.json (키: linear.teamId, linear.workspace). 없으면 사용자에게 확인.
- 프로젝트별 설정: .claude/config.json (없으면 사용자에게 확인). 실제 ID를 코드에 하드코딩하지 않는다.
