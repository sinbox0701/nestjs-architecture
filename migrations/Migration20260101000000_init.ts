import { Migration } from '@mikro-orm/migrations';

/**
 * 베이스라인(초기) 마이그레이션 — identity 도메인 스키마(roles / teams / users).
 *
 * 단일 CREATE 베이스라인이다(첫 baseline cutoff). 엔티티 변경은 이후 별도 마이그레이션으로 누적한다.
 * 모든 DDL은 **idempotent**다(IF NOT EXISTS / pg_constraint 가드) — fresh DB를 schema:create로 만든 뒤
 * 마이그레이션을 적용하는 경로에서도 안전해야 하기 때문. 참조: docs/convention/09-deployment.md
 *
 * unique는 partial index(WHERE deleted_at IS NULL)로 건다 — soft-delete 후 동명/동일 이메일 재사용 허용.
 */
export class Migration20260101000000_init extends Migration {
  override up(): void | Promise<void> {
    // roles (역할; Red/Blue… Tier1 capability 그룹)
    this.addSql(`create table if not exists "roles" (
      "id" serial primary key,
      "deleted_at" timestamptz null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "name" varchar(50) not null
    );`);
    this.addSql(
      `create unique index if not exists "roles_name_active_uq" on "roles" ("name") where "deleted_at" is null;`,
    );

    // teams (소속팀; 자원 소유 단위 → Tier2)
    this.addSql(`create table if not exists "teams" (
      "id" serial primary key,
      "deleted_at" timestamptz null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "name" varchar(100) not null,
      "role_id" int not null
    );`);
    this.addSql(
      `create unique index if not exists "teams_name_active_uq" on "teams" ("name") where "deleted_at" is null;`,
    );
    // FK 인덱스(role_id) — JOIN/부모 삭제 FK 검증 성능(11-query-strategy). 소프트삭제 무관 전체 인덱스.
    this.addSql(`create index if not exists "teams_role_id_index" on "teams" ("role_id");`);

    // users (사용자; 소속팀 1개 + 직위(position) + 전역역할(global_roles))
    this.addSql(`create table if not exists "users" (
      "id" serial primary key,
      "deleted_at" timestamptz null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "email" varchar(255) not null,
      "password" varchar(255) not null,
      "name" varchar(100) not null,
      "team_id" int not null,
      "position" text not null,
      "global_roles" text[] not null
    );`);
    this.addSql(
      `create unique index if not exists "users_email_active_uq" on "users" ("email") where "deleted_at" is null;`,
    );
    // FK 인덱스(team_id) — JOIN/부모 삭제 FK 검증 성능(11-query-strategy). 소프트삭제 무관 전체 인덱스.
    this.addSql(`create index if not exists "users_team_id_index" on "users" ("team_id");`);

    // CHECK 제약 (enum) — ADD CONSTRAINT는 IF NOT EXISTS가 없어 pg_constraint 가드로 idempotent화.
    this.addSql(`do $$ begin
      if not exists (select 1 from pg_constraint where conname = 'users_position_check') then
        alter table "users" add constraint "users_position_check" check ("position" in ('LEADER', 'MEMBER'));
      end if;
      if not exists (select 1 from pg_constraint where conname = 'users_global_roles_check') then
        alter table "users" add constraint "users_global_roles_check" check ("global_roles" <@ array['SUPER'::text]);
      end if;
    end $$;`);

    // FK 제약 (의존 순서: roles ← teams ← users)
    this.addSql(`do $$ begin
      if not exists (select 1 from pg_constraint where conname = 'teams_role_id_foreign') then
        alter table "teams" add constraint "teams_role_id_foreign" foreign key ("role_id") references "roles" ("id");
      end if;
      if not exists (select 1 from pg_constraint where conname = 'users_team_id_foreign') then
        alter table "users" add constraint "users_team_id_foreign" foreign key ("team_id") references "teams" ("id");
      end if;
    end $$;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "users" cascade;`);
    this.addSql(`drop table if exists "teams" cascade;`);
    this.addSql(`drop table if exists "roles" cascade;`);
  }
}
