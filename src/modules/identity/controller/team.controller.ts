import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';

import { ApiDataResponse, ApiPageResponse, R } from '@/common/base/response';
import { Action, Requires } from '@/lib/access-control';

import { CreateTeamRequest } from '../dto/create-team.dto';
import { GetTeamListRequest, TeamData } from '../dto/get-team.dto';
import { UpdateTeamRequest } from '../dto/update-team.dto';
import { TeamService } from '../service/team.service';

/**
 * 소속팀 관리. 권한팀 아래에 소속팀을 만든다. 플랫폼 구조 관리이므로 SUPER 전용.
 * (소속팀 내부 운영은 Tier2 ResourcePolicy로 별도 — Phase D.)
 */
@Controller('teams')
export class TeamController {
  constructor(private readonly service: TeamService) {}

  /** 소속팀 생성. */
  @Requires(Action.CREATE, 'team')
  @Post()
  @ApiDataResponse(TeamData, 201)
  async create(@Body() body: CreateTeamRequest) {
    return R.data(await this.service.createTeam(body));
  }

  /** 소속팀 목록. */
  @Requires(Action.READ, 'team')
  @Get()
  @ApiPageResponse(TeamData)
  async getList(@Query() query: GetTeamListRequest) {
    return R.page(await this.service.getTeamList(query));
  }

  /** 소속팀 단건. */
  @Requires(Action.READ, 'team')
  @Get(':id')
  @ApiDataResponse(TeamData)
  async getDetail(@Param('id') id: number) {
    return R.data(await this.service.getTeam(id));
  }

  /** 소속팀 수정. */
  @Requires(Action.UPDATE, 'team')
  @Patch(':id')
  @ApiDataResponse(TeamData)
  async update(@Param('id') id: number, @Body() body: UpdateTeamRequest) {
    return R.data(await this.service.updateTeam(id, body));
  }

  /** 소속팀 삭제(soft). */
  @Requires(Action.DELETE, 'team')
  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: number): Promise<void> {
    await this.service.deleteTeam(id);
  }
}
