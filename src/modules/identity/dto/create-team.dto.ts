import { IsInt, IsString, MaxLength, MinLength } from 'class-validator';

/** 소속팀 생성 요청. 상위 권한팀(authorityTeamId) 아래에 만든다. (응답은 `TeamData`) */
export class CreateTeamRequest {
  /** 이름 */
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  /** 상위 권한팀 ID */
  @IsInt()
  authorityTeamId!: number;
}
