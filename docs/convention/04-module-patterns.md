# 모듈 구조 패턴

## AI Quick Reference

- **Compact Feature**: 작은 bounded context → 한 폴더에 controller, service, repository + 데이터 폴더 (`order`, `note`)
- **Role-Folder**: 역할 파일이 2개 이상 → `controller/`, `service/`, `repository/` 등 역할별 폴더
- **Domain-Driven**: 여러 서브도메인을 가진 도메인 → 서브도메인별 폴더, 각 내부는 Compact/Role-Folder
- **승격 규칙**: Compact Feature → Role-Folder → Domain-Driven. 같은 역할 파일이 2개 이상이면 그 역할만 폴더로 승격
- **DO**: 기존 모듈 수정 시 해당 모듈의 로컬 스타일 유지
- **DON'T**: 새 모듈에서 기존 모듈과 다른 패턴을 임의로 도입
- `dto/`, `entity/`, `exception/`, `type/`은 항상 폴더로 유지
- **dto/ 스타일 통일**: 모든 패턴에서 행위별 bundled `.dto.ts` 사용 (상세: `05-layer-responsibility.md` DTO 파일 작성 규칙)
- backend-template는 현재 모듈이 없는 스타터 상태다. 새 도메인을 추가할 때 아래 패턴 중 하나를 선택한다.

---

중요한 원칙은 하나다. **기존 모듈을 수정할 때는 그 모듈의 로컬 스타일을 유지한다.**

## Compact Feature Pattern

작은 서브도메인에서 많이 쓰는 패턴이다.

```text
<domain>/
  dto/
  entity/
  exception/
  type/
  <domain>.module.ts
  <domain>.controller.ts
  <domain>.service.ts
  <domain>.repository.ts
```

예시 구조 (`order` 모듈):

```text
order/
  dto/
  entity/
  exception/
  type/
  order.module.ts
  order.controller.ts
  order.service.ts
  order.repository.ts
```

특징:

- 한 폴더 안에 controller, service, repository, entity, dto를 모은다.
- 파일 이동이 적고 읽기 쉽다.
- 작은 bounded context에 적합하다.

## Role-Folder Pattern

역할 이름을 그대로 폴더로 나누는 방식이다.

```text
<domain>/
  controller/
  service/
  repository/
  dto/
  entity/
  exception/
  type/
  handler/
```

예시 구조 (`notification` 모듈):

```text
notification/
  controller/
  service/
  dto/
  entity/
  exception/
  event/
  handler/
  notification.module.ts
```

특징:

- controller/service/repository 수가 늘어날 때 구조가 명확하다.
- admin/public, 여러 서브 액션 같이 역할이 늘어나는 모듈에 적합하다.

## Domain-Driven Pattern

도메인이 여러 서브도메인(bounded context)을 포함할 때 사용하는 패턴이다. 부모 모듈이 서브도메인 폴더를 가지고, 각 서브도메인 내부는 Compact Feature 또는 Role-Folder 패턴을 따른다.

```text
<domain>/
  <subdomain-a>/        ← Compact Feature 서브도메인
    dto/
    entity/
    exception/
    <subdomain-a>.module.ts
    <subdomain-a>.controller.ts
    <subdomain-a>.service.ts
  <subdomain-b>/        ← Role-Folder 서브도메인
    controller/
    dto/
    entity/
    exception/
    repository/
    <subdomain-b>.module.ts
  <domain>.module.ts    ← 부모 모듈 파일
```

특징:

- 부모 폴더에는 모듈 파일(`*.module.ts`)과 공유 유틸만 둔다.
- 각 서브도메인은 독립된 bounded context로 내부 패턴(Compact/Role-Folder)을 자유롭게 선택한다.
- `common/` 폴더는 서브도메인 간 공유하는 타입, 헬퍼, 상수를 모은다.
- 서브도메인이 2개 이상이면 Domain-Driven 패턴으로 본다.

### 승격 경로

```text
Compact Feature → Role-Folder → Domain-Driven
(역할 파일 증가)    (서브도메인 분리 필요)
```

- 단일 bounded context에서 역할 파일이 늘어나면 Role-Folder로 승격한다.
- 하나의 도메인에 서로 다른 bounded context가 생기면 Domain-Driven으로 승격한다.

## Compact + 역할 폴더 승격

"기본은 Compact지만 특정 역할만 폴더로 승격한" 형태도 유효하다.

예:

```text
<domain>/
  controller/    ← controller가 2개 이상이라 폴더로 승격
  dto/
  entity/
  exception/
  <domain>.module.ts
  <domain>.service.ts
  <domain>.repository.ts
```

### 승격 규칙

- 같은 역할 파일이 2개 이상이면 그 역할만 폴더로 승격한다.
- `dto/`, `entity/`, `exception/`, `type/`은 데이터 성격이므로 계속 폴더로 유지한다.
- 모든 모듈을 억지로 같은 패턴으로 맞추지 않는다.
- `service.ts`의 보조 로직을 담당하는 파일도 같은 역할을 하는 파일로 보고 `service/` 폴더로 승격시키고 하위에 같이 둔다.

## 새 모듈 패턴 선택 가이드

backend-template는 현재 도메인 모듈이 없는 스타터 상태다. 새 모듈을 추가할 때 아래 기준으로 패턴을 선택한다.

| 상황                                       | 권장 패턴       |
| ------------------------------------------ | --------------- |
| 단순 CRUD, 파일 1~2개                      | Compact Feature |
| controller 또는 service가 2개 이상         | Role-Folder     |
| 독립된 bounded context가 2개 이상인 도메인 | Domain-Driven   |
