import { EntityData, FindByCursorOptions, FindOptions, UpsertManyOptions } from '@mikro-orm/core';
import { EntityRepository, FilterQuery } from '@mikro-orm/postgresql';

interface CollectionLike {
  isInitialized(): boolean;
  getItems(): { deletedAt?: Date | null }[];
  loadItems(): Promise<void>;
}

function isCollectionLike(value: unknown): value is CollectionLike {
  return value != null && typeof (value as CollectionLike).isInitialized === 'function';
}

export class BaseRepository<T extends object> extends EntityRepository<T> {
  persist(entity: T | T[]): void {
    const items = Array.isArray(entity) ? entity : [entity];
    items.forEach((item) => this.em.persist(item));
  }

  /**
   * 엔티티 저장 (CREATE/UPDATE 자동 판별)
   *
   * - 새 엔티티: persist → INSERT
   * - 관리 중인 엔티티: dirty checking → UPDATE
   *
   * MikroORM의 em.persist()는 이미 관리 중인 엔티티에 대해 no-op이므로
   * CREATE/UPDATE 구분 없이 안전하게 사용 가능
   */
  async save(entity: T): Promise<T> {
    this.em.persist(entity);
    await this.em.flush();
    return entity;
  }

  async saveAll(entities: T[]): Promise<T[]> {
    if (entities.length === 0) return entities;
    entities.forEach((entity) => this.em.persist(entity));
    await this.em.flush();
    return entities;
  }

  async flush(): Promise<void> {
    await this.em.flush();
  }

  /**
   * Hard delete - 물리적으로 DB에서 제거
   */
  hardRemove(entities: T | T[]): void {
    const items = Array.isArray(entities) ? entities : [entities];
    items.forEach((entity) => this.em.remove(entity));
  }

  async hardRemoveAndFlush(entities: T | T[]): Promise<void> {
    this.hardRemove(entities);
    await this.em.flush();
  }

  /**
   * Cascade soft delete - 부모 엔티티와 관계된 자식 엔티티의 deletedAt을 일괄 설정
   *
   * @param entities - soft delete 대상 엔티티
   * @param relations - cascade 적용할 관계 프로퍼티명 (e.g., ['replies', 'comments'])
   */
  async cascadeSoftDelete<E extends T & { deletedAt?: Date | null }>(
    entities: E | E[],
    relations: (keyof E & string)[] = [],
  ): Promise<void> {
    const now = new Date();
    const items = Array.isArray(entities) ? entities : [entities];

    for (const entity of items) {
      entity.deletedAt = now;

      for (const relationName of relations) {
        const relation: unknown = (entity as Record<string, unknown>)[relationName];

        if (!relation) continue;

        if (isCollectionLike(relation)) {
          if (!relation.isInitialized()) {
            await relation.loadItems();
          }
          relation.getItems().forEach((item) => {
            if (item.deletedAt !== undefined) {
              item.deletedAt = now;
            }
          });
        } else if (typeof relation === 'object' && relation !== null && 'deletedAt' in relation) {
          (relation as { deletedAt?: Date | null }).deletedAt = now;
        }
      }
    }
  }

  async cascadeSoftDeleteAndFlush<E extends T & { deletedAt?: Date | null }>(
    entities: E | E[],
    relations: (keyof E & string)[] = [],
  ): Promise<void> {
    await this.cascadeSoftDelete(entities, relations);
    await this.em.flush();
  }

  /**
   * 대량 soft delete — 조건에 맞는 행을 nativeUpdate 한 방으로 처리한다.
   *
   * `cascadeSoftDelete`가 자식 컬렉션을 메모리에 로드해 항목마다 UPDATE하는 것과 달리,
   * 대상 행이 많을 때 단일 `UPDATE ... WHERE`로 끝낸다. (예: 부모 삭제 시
   * 자식 repo에서 `bulkSoftDelete({ parent: id })`)
   *
   * 주의: nativeUpdate는 Unit of Work / identity map을 우회한다. 이미 메모리에 로드된
   * 동일 엔티티는 stale 상태가 되므로, 같은 트랜잭션에서 이후 재사용하지 않거나
   * `em.refresh()`/재조회로 갱신한다.
   *
   * @returns 영향받은 행 수
   */
  async bulkSoftDelete(where: FilterQuery<T>): Promise<number> {
    // 모든 엔티티는 BaseEntity(deletedAt 보유)를 상속한다는 프로젝트 규약에 기반한 캐스팅.
    return this.nativeUpdate(where, { deletedAt: new Date() } as unknown as EntityData<T>);
  }

  /**
   * 커서 페이지네이션 — MikroORM `findByCursor`를 `R.cursorPage`(CursorMeta) 형태로 매핑한다.
   *
   * 필터(`where`)·정렬(`orderBy`)·`first`/`after`는 `options`에 담는다.
   * `orderBy`는 반드시 **안정 정렬**(고유 키 포함)이어야 한다. 예: `{ createdAt: 'desc', id: 'desc' }`.
   * offset 페이지네이션과 달리 deep page에서도 일정한 성능을 유지한다.
   */
  async findPageByCursor(options: FindByCursorOptions<T>): Promise<{ list: T[]; nextPageCursor?: string }> {
    // 제네릭 베이스(T 미결정)에서 findByCursor의 WithUsingOptions 조건부 타입이 좁혀지지 않아
    // 파라미터 타입으로 단언한다. 런타임 옵션 형태는 findByCursor 계약과 동일하다.
    const cursor = await this.findByCursor(options as Parameters<EntityRepository<T>['findByCursor']>[0]);
    const result: { list: T[]; nextPageCursor?: string } = { list: [...cursor.items] as T[] };
    // 다음 페이지가 없으면 키를 생략한다(R.cursorPage / CursorMeta와 동일 계약).
    if (cursor.hasNextPage && cursor.endCursor) {
      result.nextPageCursor = cursor.endCursor;
    }
    return result;
  }

  /**
   * 오프셋 페이지네이션 — `findAndCount`를 `R.page`(PageMeta) 형태(`{ list, count }`)로 매핑한다.
   *
   * `OffsetPageQuery`의 `offset`/`limit`을 `options`에 담아 호출한다. 정렬·populate도 `options`로 전달.
   * deep page(높은 offset)에서는 성능이 떨어지므로, 무한 스크롤/대용량은 `findPageByCursor`를 검토한다.
   */
  async findPage(where: FilterQuery<T>, options?: FindOptions<T>): Promise<{ list: T[]; count: number }> {
    // 제네릭 베이스에서 findAndCount의 IndexFilterQuery 조건부 타입이 좁혀지지 않아 단언한다.
    const [list, count] = await this.findAndCount(where as Parameters<EntityRepository<T>['findAndCount']>[0], options);
    return { list: list as T[], count };
  }

  /**
   * Bulk upsert — `INSERT ... ON CONFLICT`. 멱등 시더/외부 동기화에 사용한다.
   *
   * 충돌 키/병합 전략은 `options`(onConflictFields, onConflictAction 등)로 지정한다.
   * 루프에서 단건 save를 반복하는 대신 한 번의 배치 문으로 처리한다.
   */
  async upsertMany(rows: EntityData<T>[], options?: UpsertManyOptions<T>): Promise<T[]> {
    return super.upsertMany(rows, options);
  }
}
