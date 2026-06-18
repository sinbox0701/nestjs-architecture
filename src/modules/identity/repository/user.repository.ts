import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';

import { BaseRepository } from '@/common/base/base.repository';

import { GetUserListRequest } from '../dto/get-user.dto';
import { User } from '../entity/user.entity';

/**
 * User 저장소. `@Injectable` + `super(em, User)`로 자체 생성한다(엔티티 데코레이터 바인딩 없음
 * → entity↔repository 순환 회피). 요청 컨텍스트는 MikroORM RequestContext가 fork로 처리.
 */
@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(em: EntityManager) {
    super(em, User);
  }

  /** 로그인용. 비밀번호는 lazy(hidden)이라 명시 populate + 권한 정보(team→authorityTeam) 동반. */
  findByEmailForAuth(email: string): Promise<User | null> {
    return this.findOne({ email }, { populate: ['password', 'team.authorityTeam'] });
  }

  /** refresh용. team→authorityTeam 동반 조회. */
  findByIdForAuth(id: number): Promise<User | null> {
    return this.findOne({ id }, { populate: ['team.authorityTeam'] });
  }

  /** 단건 조회(없으면 null — findBy 시맨틱). */
  findById(id: number): Promise<User | null> {
    return this.findOne({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email });
  }

  /**
   * 키워드 검색 + offset 페이지네이션. BaseRepository.findPage({list,count})를 재사용.
   * leading-wildcard `%q%`는 인덱스를 못 탄다 — 소규모 가정. 대용량은 trigram/FTS 검토(11-query-strategy).
   */
  searchPage(query: GetUserListRequest): Promise<{ list: User[]; count: number }> {
    return this.findPage(query.q ? { name: { $ilike: `%${query.q}%` } } : {}, {
      offset: query.offset,
      limit: query.limit,
      orderBy: { createdAt: 'DESC' },
    });
  }
}
