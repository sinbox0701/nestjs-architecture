import { Property } from '@mikro-orm/decorators/legacy';

import { BaseEntity } from './base.entity';

/**
 * Optimistic Lock 베이스 (opt-in).
 *
 * `BaseEntity` + `version` 컬럼. 동시 수정 시 MikroORM이 로드 시점의 version과
 * flush 시점의 version을 비교해 불일치하면 `OptimisticLockError`를 던진다 → lost update 방지.
 *
 * 모든 엔티티에 version 컬럼을 강제하지 않기 위해 `BaseEntity`와 분리한 opt-in 베이스다.
 * 동시 수정이 치명적인 엔티티에만 상속한다:
 *   - 상태 전이가 핵심인 엔티티(State Machine)
 *   - 재고/잔액/카운터처럼 read-modify-write 경합이 있는 엔티티
 *
 * 일반 CRUD 엔티티는 그대로 `BaseEntity`를 상속한다.
 *
 * ```typescript
 * @Entity()
 * export class Wallet extends VersionedEntity {
 *   @Property({ type: 'integer' })
 *   balance = 0;
 * }
 * ```
 */
export abstract class VersionedEntity extends BaseEntity {
  @Property({ version: true })
  version!: number;
}
