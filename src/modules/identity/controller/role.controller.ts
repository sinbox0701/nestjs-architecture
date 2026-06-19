import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';

import { ApiDataResponse, ApiPageResponse, R } from '@/common/base/response';
import { Action, Requires } from '@/lib/access-control';

import { CreateRoleRequest } from '../dto/create-role.dto';
import { GetRoleListRequest, RoleData } from '../dto/get-role.dto';
import { UpdateRoleRequest } from '../dto/update-role.dto';
import { RoleService } from '../service/role.service';

/**
 * 역할(Red/Blue…) 관리. 플랫폼 최상위 권한 구조이므로 SUPER 전용이다.
 * (teamId 추출자가 없어 일반 팀 역할로는 통과 못 하고, globalRoles=SUPER만 PolicyGuard를 bypass한다.)
 */
@Controller('roles')
export class RoleController {
  constructor(private readonly service: RoleService) {}

  /** 역할 생성. */
  @Requires(Action.CREATE, 'role')
  @Post()
  @ApiDataResponse(RoleData, 201)
  async create(@Body() body: CreateRoleRequest) {
    return R.data(await this.service.createRole(body));
  }

  /** 역할 목록. */
  @Requires(Action.READ, 'role')
  @Get()
  @ApiPageResponse(RoleData)
  async getList(@Query() query: GetRoleListRequest) {
    return R.page(await this.service.getRoleList(query));
  }

  /** 역할 단건. */
  @Requires(Action.READ, 'role')
  @Get(':id')
  @ApiDataResponse(RoleData)
  async getDetail(@Param('id') id: number) {
    return R.data(await this.service.getRole(id));
  }

  /** 역할 수정. */
  @Requires(Action.UPDATE, 'role')
  @Patch(':id')
  @ApiDataResponse(RoleData)
  async update(@Param('id') id: number, @Body() body: UpdateRoleRequest) {
    return R.data(await this.service.updateRole(id, body));
  }

  /** 역할 삭제(soft). */
  @Requires(Action.DELETE, 'role')
  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: number): Promise<void> {
    await this.service.deleteRole(id);
  }
}
