---
name: commit
description: 작업 내역을 논리 기반으로 커밋을 나눠서 생성한다. Co-Authored-By를 포함하지 않는다.
argument-hint: '[base-branch]'
---

현재 브랜치의 unstaged/untracked 변경사항을 분석하여 논리적 단위로 커밋을 나눠 생성한다.

## 인자 해석

$ARGUMENTS 를 아래 규칙으로 해석한다.

- branch 이름이 주어지면 해당 branch 대비 diff를 분석한다.
- 인자가 없으면 working tree의 변경사항을 분석한다.

## 분석 절차

### 1단계: 변경 파일 수집

git status --short / git diff --name-only / git diff --cached --name-only

변경사항이 없으면 "커밋할 변경사항이 없습니다." 를 출력하고 종료한다.

### 2단계: 변경 분류

각 변경 파일에 대해 실제 diff를 확인하고 논리적 그룹을 분류한다:

| 우선순위 | 그룹 기준                                     | 예시                          |
| -------- | --------------------------------------------- | ----------------------------- |
| 1        | 같은 기능의 핵심 로직 (entity, service, type) | 이벤트 타입 + 엔티티 + 서비스 |
| 2        | 같은 기능의 노출 레이어 (DTO, controller)     | DTO + controller              |
| 3        | 인프라/설정 변경 (migration, config)          | migration 파일                |
| 4        | 테스트                                        | 테스트 파일                   |
| 5        | 문서                                          | docs, README                  |

### 3단계: 커밋 메시지 작성 규칙

- conventional commit 형식: type(scope): 설명
- type: feat, fix, chore, refactor, test, docs
- scope: 변경의 주요 모듈명 (여러 모듈이면 쉼표로 구분)
- 설명: 한글, 간결하게 핵심만
- **Co-Authored-By 포함하지 않는다**

#### Linear 이슈 참조 (GitLab↔Linear 연동)

커밋 본문 마지막 줄에 관련 Linear 이슈 ID를 트레일러로 넣어 GitLab↔Linear 자동 링크를 활성화한다.

- **이슈 ID 추출 순서**: ① 인자로 받은 이슈 ID → ② 현재 브랜치명에서 추출(`be-189`, `feat/BE-189` 등 `[A-Z]{2,}-\d+` 패턴, 대소문자 무시) → ③ 못 찾으면 생략(추측 금지).
- **트레일러 형식**:
  - 기본은 `Refs BE-xxx` (이슈에 활동/커밋만 연결, 상태는 안 바꿈).
  - 그 커밋/머지로 해당 이슈가 **완료**되면 `Closes BE-xxx` (MR 머지 시 Linear가 Done으로 자동 전이). 작업이 여러 커밋/여러 sub 이슈로 이어지면 `Closes`를 미리 쓰지 말 것.
  - 커밋이 특정 sub 이슈 범위면 그 sub ID를, parent 전체면 parent ID를 단다.
- 코드 주석·테스트 설명엔 이슈 번호를 넣지 않는다(추적은 커밋/MR에서만).

```
feat(wargame): 조직 콘텐츠 수강생 풀이상태 profile축 배치 조회 추가

- ChallengeRepository.getSolvingStatusMapByProfileIds 추가
- 통합 테스트 3건

Refs BE-193
```

### 4단계: 커밋 생성

각 논리 그룹별로: git add <파일들> 후 git commit -m "메시지"

### 5단계: 결과 출력

생성된 커밋: 1. <hash> <message> (N files) ...

## 규칙

- 하나의 논리적 변경은 하나의 커밋으로 묶는다
- 서로 다른 기능/목적의 변경은 반드시 분리한다
- migration은 항상 별도 커밋으로 분리한다
- 테스트는 관련 코드와 같은 커밋에 넣거나, 테스트만 있으면 별도 커밋으로 만든다
- git add . 또는 git add -A 사용 금지 — 파일을 명시적으로 지정한다
- Co-Authored-By 라인을 절대 포함하지 않는다
- 커밋 전 git status로 변경사항을 확인한다
- 커밋 후 git log --oneline으로 결과를 검증한다
