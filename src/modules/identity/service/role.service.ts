import { Injectable } from '@nestjs/common';

import { FrameworkLogger } from '@/core/logger/framework-logger';

import { CreateRoleRequest } from '../dto/create-role.dto';
import { GetRoleListRequest, RoleData } from '../dto/get-role.dto';
import { UpdateRoleRequest } from '../dto/update-role.dto';
import { Role } from '../entity/role.entity';
import { ROLE_EXCEPTIONS } from '../exception/role.exception';
import { RoleRepository } from '../repository/role.repository';
import { TeamRepository } from '../repository/team.repository';

@Injectable()
export class RoleService {
  private readonly logger = new FrameworkLogger(RoleService.name);

  constructor(
    private readonly repo: RoleRepository,
    private readonly teamRepo: TeamRepository,
  ) {}

  async createRole(dto: CreateRoleRequest): Promise<RoleData> {
    if (await this.repo.findByName(dto.name)) {
      throw ROLE_EXCEPTIONS.NAME_DUPLICATED();
    }
    const role = Role.create(dto.name);
    await this.repo.save(role);
    this.logger.log(`createRole id=${role.id} name=${role.name}`);
    return this.toData(role);
  }

  /** 없으면 예외(getBy 시맨틱). */
  async getRole(id: number): Promise<RoleData> {
    return this.toData(await this.getOrThrow(id));
  }

  async getRoleList(query: GetRoleListRequest): Promise<{ list: RoleData[]; count: number }> {
    const { list, count } = await this.repo.searchPage(query);
    return { list: list.map((t) => this.toData(t)), count };
  }

  async updateRole(id: number, dto: UpdateRoleRequest): Promise<RoleData> {
    const role = await this.getOrThrow(id);
    if (dto.name !== undefined) role.rename(dto.name);
    await this.repo.save(role);
    this.logger.log(`updateRole id=${id}`);
    return this.toData(role);
  }

  async deleteRole(id: number): Promise<void> {
    const role = await this.getOrThrow(id);
    if ((await this.teamRepo.countByAuthority(id)) > 0) {
      throw ROLE_EXCEPTIONS.HAS_TEAMS();
    }
    await this.repo.cascadeSoftDeleteAndFlush(role);
    this.logger.log(`deleteRole id=${id}`);
  }

  private async getOrThrow(id: number): Promise<Role> {
    const role = await this.repo.findById(id);
    if (!role) {
      throw ROLE_EXCEPTIONS.NOT_FOUND();
    }
    return role;
  }

  private toData(role: Role): RoleData {
    return { id: role.id, name: role.name };
  }
}
