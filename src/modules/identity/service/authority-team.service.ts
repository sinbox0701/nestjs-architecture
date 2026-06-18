import { Injectable } from '@nestjs/common';

import { FrameworkLogger } from '@/core/logger/framework-logger';

import { CreateAuthorityTeamRequest } from '../dto/create-authority-team.dto';
import { AuthorityTeamData, GetAuthorityTeamListRequest } from '../dto/get-authority-team.dto';
import { UpdateAuthorityTeamRequest } from '../dto/update-authority-team.dto';
import { AuthorityTeam } from '../entity/authority-team.entity';
import { AUTHORITY_TEAM_EXCEPTIONS } from '../exception/authority-team.exception';
import { AuthorityTeamRepository } from '../repository/authority-team.repository';
import { TeamRepository } from '../repository/team.repository';

@Injectable()
export class AuthorityTeamService {
  private readonly logger = new FrameworkLogger(AuthorityTeamService.name);

  constructor(
    private readonly repo: AuthorityTeamRepository,
    private readonly teamRepo: TeamRepository,
  ) {}

  async createAuthorityTeam(dto: CreateAuthorityTeamRequest): Promise<AuthorityTeamData> {
    if (await this.repo.findByName(dto.name)) {
      throw AUTHORITY_TEAM_EXCEPTIONS.NAME_DUPLICATED();
    }
    const team = AuthorityTeam.create(dto.name);
    await this.repo.save(team);
    this.logger.log(`createAuthorityTeam id=${team.id} name=${team.name}`);
    return this.toData(team);
  }

  /** 없으면 예외(getBy 시맨틱). */
  async getAuthorityTeam(id: number): Promise<AuthorityTeamData> {
    return this.toData(await this.getOrThrow(id));
  }

  async getAuthorityTeamList(
    query: GetAuthorityTeamListRequest,
  ): Promise<{ list: AuthorityTeamData[]; count: number }> {
    const { list, count } = await this.repo.searchPage(query);
    return { list: list.map((t) => this.toData(t)), count };
  }

  async updateAuthorityTeam(id: number, dto: UpdateAuthorityTeamRequest): Promise<AuthorityTeamData> {
    const team = await this.getOrThrow(id);
    if (dto.name !== undefined) team.rename(dto.name);
    await this.repo.save(team);
    this.logger.log(`updateAuthorityTeam id=${id}`);
    return this.toData(team);
  }

  async deleteAuthorityTeam(id: number): Promise<void> {
    const team = await this.getOrThrow(id);
    if ((await this.teamRepo.countByAuthority(id)) > 0) {
      throw AUTHORITY_TEAM_EXCEPTIONS.HAS_TEAMS();
    }
    await this.repo.cascadeSoftDeleteAndFlush(team);
    this.logger.log(`deleteAuthorityTeam id=${id}`);
  }

  private async getOrThrow(id: number): Promise<AuthorityTeam> {
    const team = await this.repo.findById(id);
    if (!team) {
      throw AUTHORITY_TEAM_EXCEPTIONS.NOT_FOUND();
    }
    return team;
  }

  private toData(team: AuthorityTeam): AuthorityTeamData {
    return { id: team.id, name: team.name };
  }
}
