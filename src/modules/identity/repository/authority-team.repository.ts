import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';

import { BaseRepository } from '@/common/base/base.repository';

import { GetAuthorityTeamListRequest } from '../dto/get-authority-team.dto';
import { AuthorityTeam } from '../entity/authority-team.entity';

@Injectable()
export class AuthorityTeamRepository extends BaseRepository<AuthorityTeam> {
  constructor(em: EntityManager) {
    super(em, AuthorityTeam);
  }

  findById(id: number): Promise<AuthorityTeam | null> {
    return this.findOne({ id });
  }

  findByName(name: string): Promise<AuthorityTeam | null> {
    return this.findOne({ name });
  }

  searchPage(query: GetAuthorityTeamListRequest): Promise<{ list: AuthorityTeam[]; count: number }> {
    return this.findPage(query.q ? { name: { $ilike: `%${query.q}%` } } : {}, {
      offset: query.offset,
      limit: query.limit,
      orderBy: { createdAt: 'DESC' },
    });
  }
}
