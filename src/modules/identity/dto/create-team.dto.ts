import { IsInt, IsString, MaxLength, MinLength } from 'class-validator';

/** 소속팀 생성 요청. 상위 역할(roleId) 아래에 만든다. (응답은 `TeamData`) */
export class CreateTeamRequest {
  /** 이름 */
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  /** 상위 역할 ID */
  @IsInt()
  roleId!: number;
}
