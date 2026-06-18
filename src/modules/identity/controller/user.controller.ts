import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';

import { Request } from 'express';

import { ApiDataResponse, ApiPageResponse, R } from '@/common/base/response';
import { Action, AuthSubject, Requires } from '@/lib/access-control';

import { CreateUserRequest } from '../dto/create-user.dto';
import { GetUserListRequest, UserData } from '../dto/get-user.dto';
import { UpdateUserRequest } from '../dto/update-user.dto';
import { UserService } from '../service/user.service';

/** Tier1 teamId는 라우트가 아니라 actor 자신의 소속팀에서 가져온다(유저당 1팀). */
const ownTeamId = (req: Request) => (req.user as AuthSubject | undefined)?.teams?.[0]?.teamId;

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** 사용자 생성. (소속팀 자원 — 권한팀 capability + 팀장 권한 필요) */
  @Requires(Action.CREATE, 'user', { teamId: ownTeamId })
  @Post()
  @ApiDataResponse(UserData, 201)
  async create(@Body() body: CreateUserRequest) {
    return R.data(await this.userService.createUser(body));
  }

  /** 사용자 목록 조회. */
  @Requires(Action.READ, 'user', { teamId: ownTeamId })
  @Get()
  @ApiPageResponse(UserData)
  async getList(@Query() query: GetUserListRequest) {
    return R.page(await this.userService.getUserList(query));
  }

  /** 사용자 단건 조회. */
  @Requires(Action.READ, 'user', { teamId: ownTeamId })
  @Get(':id')
  @ApiDataResponse(UserData)
  async getDetail(@Param('id') id: number) {
    return R.data(await this.userService.getUser(id));
  }

  /** 사용자 수정. */
  @Requires(Action.UPDATE, 'user', { teamId: ownTeamId })
  @Patch(':id')
  @ApiDataResponse(UserData)
  async update(@Param('id') id: number, @Body() body: UpdateUserRequest) {
    return R.data(await this.userService.updateUser(id, body));
  }

  /** 사용자 삭제(soft). */
  @Requires(Action.DELETE, 'user', { teamId: ownTeamId })
  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: number): Promise<void> {
    await this.userService.deleteUser(id);
  }
}
