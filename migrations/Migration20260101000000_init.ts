import { Migration } from '@mikro-orm/migrations';

/**
 * 베이스라인(초기) 마이그레이션.
 *
 * 스타터에는 아직 엔티티가 없으므로 이 마이그레이션은 no-op이다.
 * 첫 엔티티를 추가한 뒤:
 *   1) dev에서 `schema.update()`(DatabaseModule 자동)로 스키마를 맞추고
 *   2) `pnpm migration:create`로 실제 DDL을 가진 마이그레이션을 생성한다.
 *
 * Baseline 전진/squash 절차는 docs/convention/10-deployment.md 참조.
 */
export class Migration20260101000000_init extends Migration {
  override async up(): Promise<void> {
    // no-op baseline
  }

  override async down(): Promise<void> {
    // no-op baseline
  }
}
