import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';

import { ApiDataResponse, ApiPageResponse, R } from '@/common/base/response';
import { Action, AuthSubject, CurrentUser, Requires } from '@/lib/access-control';

import { CreateUserRequest } from '../dto/create-user.dto';
import { GetUserListRequest, UserData } from '../dto/get-user.dto';
import { UpdateUserRequest } from '../dto/update-user.dto';
import { UserService } from '../service/user.service';

/**
 * 사용자 관리. Tier1(@Requires)은 역할(Role) capability(Red=관리/Blue=읽기)를, Tier2(service의
 * UserResourcePolicy)는 소속팀 소유 + 팀장/팀원/본인 규칙을 본다. actor는 @CurrentUser로 주입한다.
 */
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** 사용자 생성. (Tier2: 대상 팀의 팀장만) */
  @Requires(Action.CREATE, 'user')
  @Post()
  @ApiDataResponse(UserData, 201)
  async create(@CurrentUser() actor: AuthSubject, @Body() body: CreateUserRequest) {
    return R.data(await this.userService.createUser(actor, body));
  }

  /** 사용자 목록 조회. (Tier2: 자기 소속팀으로 스코프, SUPER는 전체) */
  @Requires(Action.READ, 'user')
  @Get()
  @ApiPageResponse(UserData)
  async getList(@CurrentUser() actor: AuthSubject, @Query() query: GetUserListRequest) {
    return R.page(await this.userService.getUserList(actor, query));
  }

  /** 사용자 단건 조회. (Tier2: 같은 소속팀) */
  @Requires(Action.READ, 'user')
  @Get(':id')
  @ApiDataResponse(UserData)
  async getDetail(@CurrentUser() actor: AuthSubject, @Param('id') id: number) {
    return R.data(await this.userService.getUser(actor, id));
  }

  /** 사용자 수정. (Tier2: 팀장은 팀원/본인은 프로필, 역할 변경은 팀장만) */
  @Requires(Action.UPDATE, 'user')
  @Patch(':id')
  @ApiDataResponse(UserData)
  async update(@CurrentUser() actor: AuthSubject, @Param('id') id: number, @Body() body: UpdateUserRequest) {
    return R.data(await this.userService.updateUser(actor, id, body));
  }

  /** 사용자 삭제(soft). (Tier2: 팀장만, 본인 제외) */
  @Requires(Action.DELETE, 'user')
  @Delete(':id')
  @HttpCode(204)
  async delete(@CurrentUser() actor: AuthSubject, @Param('id') id: number): Promise<void> {
    await this.userService.deleteUser(actor, id);
  }
}
