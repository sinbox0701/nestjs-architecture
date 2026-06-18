import { MikroORM } from '@mikro-orm/postgresql';

/**
 * 모든 (concrete) 엔티티 테이블을 TRUNCATE 한다.
 *
 * ORM 메타데이터에서 테이블 목록을 동적으로 도출하므로, 수동 테이블 목록을
 * 유지할 필요가 없다. 이는 camp-backend 의 `TABLES_TO_TRUNCATE` 수동 배열이
 * 야기하던 버그군(엔티티 추가 시 목록 누락, FK 순서 의존 등)을 제거한다.
 *
 * abstract / embeddable / virtual 엔티티는 실제 테이블이 없으므로 제외하며,
 * RESTART IDENTITY CASCADE 로 시퀀스 초기화 + 의존 행 정리를 한 번에 수행한다.
 */
export async function truncateAll(orm: MikroORM): Promise<void> {
  const meta = orm.getMetadata().getAll();
  const names = Object.values(meta)
    .filter((m) => Boolean(m.tableName) && !m.abstract && !m.embeddable && !(m as { virtual?: boolean }).virtual)
    .map((m) => `"${m.schema ? m.schema + '"."' : ''}${m.tableName}"`);
  if (!names.length) return;
  await orm.em.getConnection().execute(`TRUNCATE TABLE ${names.join(', ')} RESTART IDENTITY CASCADE`);
}
