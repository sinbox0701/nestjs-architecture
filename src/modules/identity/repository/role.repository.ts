import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';

import { BaseRepository } from '@/common/base/base.repository';

import { GetRoleListRequest } from '../dto/get-role.dto';
import { Role } from '../entity/role.entity';

@Injectable()
export class RoleRepository extends BaseRepository<Role> {
  constructor(em: EntityManager) {
    super(em, Role);
  }

  findById(id: number): Promise<Role | null> {
    return this.findOne({ id });
  }

  findByName(name: string): Promise<Role | null> {
    return this.findOne({ name });
  }

  searchPage(query: GetRoleListRequest): Promise<{ list: Role[]; count: number }> {
    return this.findPage(query.q ? { name: { $ilike: `%${query.q}%` } } : {}, {
      offset: query.offset,
      limit: query.limit,
      orderBy: { createdAt: 'DESC' },
    });
  }
}
