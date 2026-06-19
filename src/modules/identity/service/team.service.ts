import { Injectable } from '@nestjs/common';

import { FrameworkLogger } from '@/core/logger/framework-logger';

import { CreateTeamRequest } from '../dto/create-team.dto';
import { GetTeamListRequest, TeamData } from '../dto/get-team.dto';
import { UpdateTeamRequest } from '../dto/update-team.dto';
import { Team } from '../entity/team.entity';
import { ROLE_EXCEPTIONS } from '../exception/role.exception';
import { TEAM_EXCEPTIONS } from '../exception/team.exception';
import { RoleRepository } from '../repository/role.repository';
import { TeamRepository } from '../repository/team.repository';
import { UserRepository } from '../repository/user.repository';

@Injectable()
export class TeamService {
  private readonly logger = new FrameworkLogger(TeamService.name);

  constructor(
    private readonly repo: TeamRepository,
    private readonly roleRepo: RoleRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async createTeam(dto: CreateTeamRequest): Promise<TeamData> {
    const role = await this.roleRepo.findById(dto.roleId);
    if (!role) {
      throw ROLE_EXCEPTIONS.NOT_FOUND();
    }
    if (await this.repo.findByName(dto.name)) {
      throw TEAM_EXCEPTIONS.NAME_DUPLICATED();
    }
    const team = Team.create(dto.name, role);
    await this.repo.save(team);
    this.logger.log(`createTeam id=${team.id} roleId=${dto.roleId}`);
    return this.toData(team);
  }

  /** 없으면 예외(getBy 시맨틱). */
  async getTeam(id: number): Promise<TeamData> {
    return this.toData(await this.getOrThrow(id));
  }

  async getTeamList(query: GetTeamListRequest): Promise<{ list: TeamData[]; count: number }> {
    const { list, count } = await this.repo.searchPage(query);
    return { list: list.map((t) => this.toData(t)), count };
  }

  async updateTeam(id: number, dto: UpdateTeamRequest): Promise<TeamData> {
    const team = await this.getOrThrow(id);
    if (dto.name !== undefined) team.rename(dto.name);
    await this.repo.save(team);
    this.logger.log(`updateTeam id=${id}`);
    return this.toData(team);
  }

  async deleteTeam(id: number): Promise<void> {
    const team = await this.getOrThrow(id);
    if ((await this.userRepo.countByTeam(id)) > 0) {
      throw TEAM_EXCEPTIONS.HAS_MEMBERS();
    }
    await this.repo.cascadeSoftDeleteAndFlush(team);
    this.logger.log(`deleteTeam id=${id}`);
  }

  private async getOrThrow(id: number): Promise<Team> {
    const team = await this.repo.findById(id);
    if (!team) {
      throw TEAM_EXCEPTIONS.NOT_FOUND();
    }
    return team;
  }

  private toData(team: Team): TeamData {
    // role은 Ref — ref.id만 사용(미populate 안전).
    return { id: team.id, name: team.name, roleId: team.role.id };
  }
}
