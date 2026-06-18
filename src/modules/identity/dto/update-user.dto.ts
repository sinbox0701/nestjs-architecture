import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

import { TeamRole } from '../enum/team-role.enum';

/** 사용자 수정 요청. 값이 없을 수 있는 필드는 optional(`?:`), `| null` 금지. */
export class UpdateUserRequest {
  /** 이름 */
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  /** 소속팀 내 역할 */
  @IsOptional()
  @IsEnum(TeamRole)
  role?: TeamRole;
}
