import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';

import { BaseRepository } from '@/common/base/base.repository';

import { GetTeamListRequest } from '../dto/get-team.dto';
import { Team } from '../entity/team.entity';

@Injectable()
export class TeamRepository extends BaseRepository<Team> {
  constructor(em: EntityManager) {
    super(em, Team);
  }

  findById(id: number): Promise<Team | null> {
    return this.findOne({ id });
  }

  findByName(name: string): Promise<Team | null> {
    return this.findOne({ name });
  }

  /** 해당 권한팀에 속한 활성 소속팀 수(soft-delete 제외). 권한팀 삭제 가드에 사용. */
  countByAuthority(authorityTeamId: number): Promise<number> {
    return this.count({ authorityTeam: authorityTeamId });
  }

  searchPage(query: GetTeamListRequest): Promise<{ list: Team[]; count: number }> {
    return this.findPage(query.q ? { name: { $ilike: `%${query.q}%` } } : {}, {
      offset: query.offset,
      limit: query.limit,
      orderBy: { createdAt: 'DESC' },
    });
  }
}
