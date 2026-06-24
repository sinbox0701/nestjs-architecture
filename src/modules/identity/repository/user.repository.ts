import { Injectable } from '@nestjs/common';
import { EntityManager, FilterQuery } from '@mikro-orm/postgresql';

import { BaseRepository } from '@/common/base/base.repository';

import { GetUserListRequest } from '../dto/get-user.dto';
import { User } from '../entity/user.entity';

/** 목록 조회 스코프(Tier2). `teamIds`가 주어지면 해당 소속팀들로 제한한다. */
export interface UserSearchScope {
  teamIds?: number[];
}

/**
 * User 저장소. `@Injectable` + `super(em, User)`로 자체 생성한다(엔티티 데코레이터 바인딩 없음
 * → entity↔repository 순환 회피). 요청 컨텍스트는 MikroORM RequestContext가 fork로 처리.
 */
@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(em: EntityManager) {
    super(em, User);
  }

  /** 로그인용. 비밀번호는 lazy(hidden)이라 명시 populate + 권한 정보(team→role) 동반. */
  findByEmailForAuth(email: string): Promise<User | null> {
    return this.findOne({ email }, { populate: ['password', 'team.role'] });
  }

  /** refresh용. team→role 동반 조회. */
  findByIdForAuth(id: number): Promise<User | null> {
    return this.findOne({ id }, { populate: ['team.role'] });
  }

  /** 단건 조회(없으면 null — findBy 시맨틱). */
  findById(id: number): Promise<User | null> {
    return this.findOne({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email });
  }

  /** 해당 팀의 활성 사용자 수(soft-delete 제외). 팀 삭제 가드에 사용. */
  countByTeam(teamId: number): Promise<number> {
    return this.count({ team: teamId });
  }

  /**
   * 키워드 검색 + offset 페이지네이션. BaseRepository.findPage({list,count})를 재사용.
   * `scope.teamIds`가 주어지면 해당 소속팀들로 제한한다(Tier2 목록 스코프 — cross-team 노출 방지).
   * leading-wildcard `%q%`는 인덱스를 못 탄다 — 소규모 가정. 대용량은 trigram/FTS 검토(10-query-strategy).
   */
  searchPage(query: GetUserListRequest, scope?: UserSearchScope): Promise<{ list: User[]; count: number }> {
    const where: FilterQuery<User> = {};
    if (query.q) where.name = { $ilike: `%${query.q}%` };
    if (scope?.teamIds !== undefined) where.team = { $in: scope.teamIds };
    return this.findPage(where, {
      offset: query.offset,
      limit: query.limit,
      orderBy: { createdAt: 'DESC' },
    });
  }
}
