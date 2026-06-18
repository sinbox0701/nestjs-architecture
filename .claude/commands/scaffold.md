---
name: scaffold
description: 04-module-patterns.md 기반으로 새 모듈/서브도메인의 파일 뼈대를 자동 생성한다.
argument-hint: '<module-path> [--pattern compact|role-folder]'
---

지정된 경로에 컨벤션에 맞는 모듈 뼈대를 생성한다.

## 인자 해석

$ARGUMENTS 를 아래 규칙으로 해석한다.

- 첫 번째 인자: 모듈 경로 (예: order, billing/invoice)
- --pattern: compact 또는 role-folder (생략 시 자동 판단)

예시: /scaffold order, /scaffold billing/invoice

## 사전 준비

docs/convention/04-module-patterns.md 와 docs/convention/07-naming-and-style.md 를 읽는다.

경로 분석:

- /가 있으면 서브도메인 추가. 부모 모듈 존재 확인.
- /가 없으면 새 독립 모듈. 이미 있으면 에러.

패턴 결정: --pattern 없으면 사용자에게 질문한다.

## Compact Feature 구조

dto/.gitkeep, entity/<domain>.entity.ts, exception/<domain>.exception.ts,
<domain>.module.ts, <domain>.controller.ts, <domain>.service.ts, <domain>.repository.ts

## Role-Folder 구조

controller/<domain>.controller.ts, controller/<domain>.admin.controller.ts,
service/<domain>.service.ts, repository/<domain>.repository.ts,
dto/.gitkeep, entity/<domain>.entity.ts, exception/<domain>.exception.ts, <domain>.module.ts

## 파일 내용 템플릿

module.ts: @Module({ imports:[MikroOrmModule.forFeature([<Entity>])], controllers:[<Controller>], providers:[<Service>,<Repository>], exports:[<Service>] }) export class <Domain>Module {}

entity.ts: import { Entity } from @mikro-orm/decorators/legacy; import { BaseEntity } from @/common/base/base.entity; @Entity() export class <Entity> extends BaseEntity { static create(params): <Entity> { return new <Entity>(); } }

exception.ts: import { HttpStatus } from @nestjs/common; import { HttpException } from @/common/exceptions/http.exception; export const <DOMAIN>_EXCEPTIONS = { NOT_FOUND: (msg) => new HttpException("404_<DOMAIN>", msg, HttpStatus.NOT_FOUND) };

controller.ts: @Controller("<route>") export class <Controller> { constructor(private readonly service: <Service>) {} }

service.ts: @Injectable() export class <Service> { constructor(private readonly repo: <Repository>) {} }

repository.ts: @Injectable() export class <Repository> extends BaseRepository<<Entity>> {}

## 서브도메인 추가 시

1. 부모 모듈 파일에 새 서브도메인 모듈을 import/등록한다

## 생성 후

1. 생성된 파일 목록을 출력한다
2. TODO 마커가 있는 곳을 안내한다
3. pnpm build로 컴파일 오류가 없는지 확인한다

## 규칙

- docs/convention/04-module-patterns.md의 모듈 인벤토리 테이블에 새 모듈을 추가한다
- 네이밍은 docs/convention/07-naming-and-style.md를 따른다
- Entity는 반드시 static create() 팩토리를 포함한다
- Exception은 반드시 팩토리 상수 패턴을 따른다
- 빈 폴더에는 .gitkeep을 넣는다
