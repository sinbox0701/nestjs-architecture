---
name: status
description: SDD 파이프라인 현황을 보여준다. docs/prd/ 스캔 + Linear 이슈 상태 조회.
argument-hint: ''
---

현재 프로젝트의 SDD 파이프라인 현황을 한눈에 보여준다.

## 수집

### 1. 파일시스템 스캔

docs/prd/ 디렉토리를 스캔한다:

- *.md (단, _template.md, _spec-template.md 제외) → PRD 목록
- *.spec.md → 스펙 완료 여부
- 각 PRD의 frontmatter에서 title, type, status 추출

### 2. Linear 이슈 조회 (가능한 경우)

Linear MCP가 사용 가능하면:

- [BE] prefix 이슈 중 최근 생성된 것들을 조회
- PRD title과 매칭하여 이슈 생성 여부 및 상태 파악
- 각 이슈의 sub-issue 진행 상태 (Todo / In Progress / Done)

Linear MCP가 없으면 파일시스템 정보만으로 출력한다.

**Linear 설정**: .claude/config.json (키: linear.teamId, linear.workspace). 없으면 사용자에게 확인.
프로젝트별 설정: .claude/config.json (없으면 사용자에게 확인). 실제 ID를 코드에 하드코딩하지 않는다.

### 3. 최근 작업 이력

git log --oneline -10 으로 최근 커밋을 조회한다.

최근 커밋에서 관련 모듈/기능 추출.

## 출력

| 기능 | Type | PRD | 스펙 | 이슈 | 진행 상태 |
|------|------|-----|------|------|-----------|
| 주문 | feature | ✅ | ✅ | BE-301~304 | Service 진행중 |
| SSO | enabler | ✅ | ❌ | - | 스펙 필요 |

### 다음 액션
- SSO: /spec docs/prd/sso.md 로 스펙 생성
- 주문: BE-303 pick → 코딩 시작

### 최근 커밋 (관련)
- f95f456 (2일 전) feat(order): 주문 상태 전이 로직 추가

## 규칙

- PRD가 없으면 docs/prd/에 PRD가 없습니다. _template.md를 복사해서 시작하세요. 출력
- 스펙이 없는 PRD는 스펙 필요 상태로 표시
- Linear 연결이 안 되면 파일 기반 정보만 보여주고, Linear 상태는 조회 불가로 표시
- 이슈의 sub-issue가 모두 Done이면 완료로 표시
- 출력은 간결하게. 한 화면에 들어오는 분량.