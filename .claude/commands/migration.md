---
name: migration
description: 현재 브랜치의 엔티티 변경사항을 분석하여 migration 파일을 생성한다.
argument-hint: '[base-branch]'
---

현재 브랜치에서 변경된 엔티티를 분석하여 migration 파일을 생성한다.

## 인자 해석

- branch 이름이 주어지면 해당 branch 대비 diff를 분석한다.
- 인자가 없으면 main 브랜치 대비로 분석한다.

## 분석 절차

### 1단계: 변경된 엔티티 파일 수집

git diff <base-branch>...HEAD --name-only -- \*.entity.ts

변경된 엔티티 파일이 없으면 DB 변경사항이 없습니다. 를 출력하고 종료한다.

### 2단계: 엔티티 diff 분석

| 변경 유형      | 감지 방법                                         |
| -------------- | ------------------------------------------------- |
| 컬럼 추가      | @Property(), @Enum() 데코레이터 붙은 새 필드 추가 |
| 컬럼 삭제      | 기존 필드 제거                                    |
| 컬럼 타입 변경 | @Property({ type: ... }) type 변경                |
| nullable 변경  | nullable: true/false 변경                         |
| 새 엔티티      | 파일 신규 (CREATE TABLE)                          |
| 엔티티 삭제    | 파일 삭제 (DROP TABLE)                            |
| 인덱스 변경    | @Index(), @Unique() 변경                          |

### 3단계: SQL 생성 규칙

MikroORM → PostgreSQL 타입 매핑:
varchar → varchar(255), text → text, integer → int4, bigint → int8,
boolean → boolean, json → jsonb, timestamptz → timestamptz,
Enum → varchar(255)

camelCase → snake_case: vpnIp → vpn_ip, createdAt → created_at

nullable: true 또는 ? → null; 그 외 → not null

### 4단계: 기존 migration 파일 확인

migrations/ 에서 중복 확인. 파일명 타임스탬프 겹치지 않도록 한다.

### 5단계: migration 파일 생성

파일명: Migration{YYYYMMDD}{HHmmss}*{변경*요약}.ts

import { Migration } from @mikro-orm/migrations;
export class MigrationXXX extends Migration {
up(): void { this.addSql(SQL); }
down(): void { this.addSql(역방향SQL); }
}

SQL 규칙: 테이블명/컬럼명 쌍따옴표. up()/down() 항상 쌍.

#### Idempotent SQL 필수 (docs/convention/10-deployment.md)

✅ CREATE INDEX IF NOT EXISTS, ALTER TABLE ... ADD COLUMN IF NOT EXISTS, DROP INDEX IF EXISTS
❌ Non-idempotent 패턴 금지

@Enum 변경: DROP CONSTRAINT IF EXISTS → UPDATE data → ADD CONSTRAINT

생성 후: pnpm migration:verify 로 로컬 dry-run 실행

### 6단계: 변경 여러 개일 때

서로 다른 테이블 변경은 하나의 파일에 모아도 된다. 의미적으로 무관하면 분리. 사용자에게 확인.

## 출력

생성된 migration: migrations/Migration{타임스탬프}\_{요약}.ts
변경 내용 표 + SQL 미리보기

## 규칙

- migration 테이블: backend_template_migrations
- 테스트 DB: backend_template_test
- Idempotent SQL 필수. docs/convention/10-deployment.md 참조.
- 생성 후 반드시 pnpm migration:verify 로 검증한다.
