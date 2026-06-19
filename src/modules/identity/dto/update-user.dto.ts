import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

import { TeamPosition } from '../enum/team-position.enum';

/** 사용자 수정 요청. */
export class UpdateUserRequest {
  /** 이름 */
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  /** 소속팀 내 직위 */
  @IsOptional()
  @IsEnum(TeamPosition)
  position?: TeamPosition;
}
