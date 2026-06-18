import { MikroORM } from '@mikro-orm/postgresql';

import { truncateAll } from '@test-utils/helpers/db-test.helper';
import { initTestOrm } from '@test-utils/helpers/orm-test.helper';

describe('integration smoke (db)', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await initTestOrm();
  });

  afterAll(async () => {
    await orm.close(true);
  });

  it('connects to Postgres and runs a query', async () => {
    await truncateAll(orm);

    const result = await orm.em.getConnection().execute<{ ok: number }[]>('SELECT 1 as ok');

    expect(result).toEqual([{ ok: 1 }]);
  });
});
