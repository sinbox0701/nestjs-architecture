import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** 소속팀 수정 요청. */
export class UpdateTeamRequest {
  /** 이름 */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;
}
