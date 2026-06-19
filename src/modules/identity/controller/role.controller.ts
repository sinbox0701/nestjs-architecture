import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';

import { ApiDataResponse, ApiPageResponse, R } from '@/common/base/response';
import { Action, Requires } from '@/lib/access-control';

import { CreateAuthorityTeamRequest } from '../dto/create-authority-team.dto';
import { AuthorityTeamData, GetAuthorityTeamListRequest } from '../dto/get-authority-team.dto';
import { UpdateAuthorityTeamRequest } from '../dto/update-authority-team.dto';
import { AuthorityTeamService } from '../service/authority-team.service';

/**
 * 권한팀(Red/Blue…) 관리. 플랫폼 최상위 권한 구조이므로 SUPER 전용이다.
 * (teamId 추출자가 없어 일반 팀 역할로는 통과 못 하고, globalRoles=SUPER만 PolicyGuard를 bypass한다.)
 */
@Controller('authority-teams')
export class AuthorityTeamController {
  constructor(private readonly service: AuthorityTeamService) {}

  /** 권한팀 생성. */
  @Requires(Action.CREATE, 'authority-team')
  @Post()
  @ApiDataResponse(AuthorityTeamData, 201)
  async create(@Body() body: CreateAuthorityTeamRequest) {
    return R.data(await this.service.createAuthorityTeam(body));
  }

  /** 권한팀 목록. */
  @Requires(Action.READ, 'authority-team')
  @Get()
  @ApiPageResponse(AuthorityTeamData)
  async getList(@Query() query: GetAuthorityTeamListRequest) {
    return R.page(await this.service.getAuthorityTeamList(query));
  }

  /** 권한팀 단건. */
  @Requires(Action.READ, 'authority-team')
  @Get(':id')
  @ApiDataResponse(AuthorityTeamData)
  async getDetail(@Param('id') id: number) {
    return R.data(await this.service.getAuthorityTeam(id));
  }

  /** 권한팀 수정. */
  @Requires(Action.UPDATE, 'authority-team')
  @Patch(':id')
  @ApiDataResponse(AuthorityTeamData)
  async update(@Param('id') id: number, @Body() body: UpdateAuthorityTeamRequest) {
    return R.data(await this.service.updateAuthorityTeam(id, body));
  }

  /** 권한팀 삭제(soft). */
  @Requires(Action.DELETE, 'authority-team')
  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: number): Promise<void> {
    await this.service.deleteAuthorityTeam(id);
  }
}
