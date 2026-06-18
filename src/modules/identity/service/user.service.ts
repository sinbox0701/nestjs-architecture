import { Injectable } from '@nestjs/common';

import { PasswordUtil } from '@/common/utils/password.util';
import { FrameworkLogger } from '@/core/logger/framework-logger';

import { CreateUserRequest } from '../dto/create-user.dto';
import { GetUserListRequest, UserData } from '../dto/get-user.dto';
import { UpdateUserRequest } from '../dto/update-user.dto';
import { User } from '../entity/user.entity';
import { TEAM_EXCEPTIONS } from '../exception/team.exception';
import { USER_EXCEPTIONS } from '../exception/user.exception';
import { TeamRepository } from '../repository/team.repository';
import { UserRepository } from '../repository/user.repository';

@Injectable()
export class UserService {
  private readonly logger = new FrameworkLogger(UserService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly teamRepo: TeamRepository,
  ) {}

  async createUser(dto: CreateUserRequest): Promise<UserData> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw USER_EXCEPTIONS.EMAIL_DUPLICATED();
    }
    const team = await this.teamRepo.findById(dto.teamId);
    if (!team) {
      throw TEAM_EXCEPTIONS.NOT_FOUND();
    }
    const passwordHash = await PasswordUtil.hash(dto.password);
    const user = User.create({ email: dto.email, passwordHash, name: dto.name, team, role: dto.role });
    await this.userRepo.save(user);
    this.logger.log(`createUser id=${user.id} email=${user.email} teamId=${dto.teamId}`);
    return this.toData(user);
  }

  /** 없으면 예외(getBy 시맨틱). */
  async getUser(id: number): Promise<UserData> {
    return this.toData(await this.getUserOrThrow(id));
  }

  async getUserList(query: GetUserListRequest): Promise<{ list: UserData[]; count: number }> {
    const { list, count } = await this.userRepo.searchPage(query);
    return { list: list.map((u) => this.toData(u)), count };
  }

  async updateUser(id: number, dto: UpdateUserRequest): Promise<UserData> {
    const user = await this.getUserOrThrow(id);
    if (dto.name !== undefined) user.updateProfile(dto.name);
    if (dto.role !== undefined) user.changeRole(dto.role);
    await this.userRepo.save(user);
    this.logger.log(`updateUser id=${id}`);
    return this.toData(user);
  }

  async deleteUser(id: number): Promise<void> {
    const user = await this.getUserOrThrow(id);
    // soft delete. 전역 softDelete 필터(default:true)가 이후 조회에서 제외한다.
    await this.userRepo.cascadeSoftDeleteAndFlush(user);
    this.logger.log(`deleteUser id=${id}`);
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
    return { id: user.id, email: user.email, name: user.name, teamId: user.team.id, role: user.role };
  }
}
