import { Injectable } from '@nestjs/common';

import { PasswordUtil } from '@/common/utils/password.util';
import { FrameworkLogger } from '@/core/logger/framework-logger';
import { Action, AuthSubject, GlobalRole, loadAndAuthorize } from '@/lib/access-control';

import { UserResourcePolicy } from '../access/user.resource-policy';
import { CreateUserRequest } from '../dto/create-user.dto';
import { GetUserListRequest, UserData } from '../dto/get-user.dto';
import { UpdateUserRequest } from '../dto/update-user.dto';
import { User } from '../entity/user.entity';
import { TEAM_EXCEPTIONS } from '../exception/team.exception';
import { USER_EXCEPTIONS } from '../exception/user.exception';
import { TeamRepository } from '../repository/team.repository';
import { UserRepository } from '../repository/user.repository';

/**
 * 사용자 유스케이스. 모든 메서드는 actor(AuthSubject)를 받아 Tier2 인가(UserResourcePolicy)를 수행한다.
 * Tier1(역할 capability)은 컨트롤러 @Requires + PolicyGuard가 이미 통과시킨 상태.
 */
@Injectable()
export class UserService {
  private readonly logger = new FrameworkLogger(UserService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly teamRepo: TeamRepository,
    private readonly policy: UserResourcePolicy,
  ) {}

  async createUser(actor: AuthSubject, dto: CreateUserRequest): Promise<UserData> {
    // 인가 먼저: 대상 팀의 팀장만 멤버를 추가할 수 있다(SUPER bypass).
    this.policy.authorizeCreate(actor, { teamId: dto.teamId });

    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw USER_EXCEPTIONS.EMAIL_DUPLICATED();
    }
    const team = await this.teamRepo.findById(dto.teamId);
    if (!team) {
      throw TEAM_EXCEPTIONS.NOT_FOUND();
    }
    const passwordHash = await PasswordUtil.hash(dto.password);
    const user = User.create({ email: dto.email, passwordHash, name: dto.name, team, position: dto.position });
    await this.userRepo.save(user);
    this.logger.log(`createUser id=${user.id} email=${user.email} teamId=${dto.teamId} by=${String(actor.id)}`);
    return this.toData(user);
  }

  /** 없으면 예외(getBy 시맨틱). 같은 소속팀 구성원만 조회 가능. */
  async getUser(actor: AuthSubject, id: number): Promise<UserData> {
    const user = await loadAndAuthorize((uid) => this.getUserOrThrow(uid), this.policy, actor, Action.READ, id);
    return this.toData(user);
  }

  /** 목록은 actor의 소속팀으로 스코프(SUPER는 전체). cross-team 정보 노출 방지. */
  async getUserList(actor: AuthSubject, query: GetUserListRequest): Promise<{ list: UserData[]; count: number }> {
    if (this.isSuper(actor)) {
      const { list, count } = await this.userRepo.searchPage(query);
      return { list: list.map((u) => this.toData(u)), count };
    }
    // non-SUPER는 반드시 소속팀으로 제한. 팀이 없으면(이론상 도달 불가) 빈 결과 — 전체 노출 차단.
    const teamId = actor.teams[0]?.teamId;
    if (teamId === undefined) {
      return { list: [], count: 0 };
    }
    const { list, count } = await this.userRepo.searchPage(query, { teamId });
    return { list: list.map((u) => this.toData(u)), count };
  }

  async updateUser(actor: AuthSubject, id: number, dto: UpdateUserRequest): Promise<UserData> {
    const user = await loadAndAuthorize((uid) => this.getUserOrThrow(uid), this.policy, actor, Action.UPDATE, id);
    if (dto.name !== undefined) user.updateProfile(dto.name);
    if (dto.position !== undefined) {
      // 직위 변경은 별도 인가(팀장만, 본인 제외). 본인이 자기 직위를 올리는 권한 상승 차단.
      this.policy.authorizeChangeRole(actor, user);
      user.changePosition(dto.position);
    }
    await this.userRepo.save(user);
    this.logger.log(`updateUser id=${id} by=${String(actor.id)}`);
    return this.toData(user);
  }

  async deleteUser(actor: AuthSubject, id: number): Promise<void> {
    const user = await loadAndAuthorize((uid) => this.getUserOrThrow(uid), this.policy, actor, Action.DELETE, id);
    // soft delete. 전역 softDelete 필터(default:true)가 이후 조회에서 제외한다.
    await this.userRepo.cascadeSoftDeleteAndFlush(user);
    this.logger.log(`deleteUser id=${id} by=${String(actor.id)}`);
  }

  private isSuper(actor: AuthSubject): boolean {
    return actor.globalRoles?.includes(GlobalRole.SUPER) ?? false;
  }

  private async getUserOrThrow(id: number): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw USER_EXCEPTIONS.NOT_FOUND();
    }
    return user;
  }

  private toData(user: User): UserData {
    // team은 Ref<Team> — ref.id만 사용(미populate에서도 안전). 다른 team 필드가 필요하면 populate할 것.
    return { id: user.id, email: user.email, name: user.name, teamId: user.team.id, position: user.position };
  }
}
