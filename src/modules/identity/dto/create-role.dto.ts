import { IsString, MaxLength, MinLength } from 'class-validator';

/** 권한팀 생성 요청. name이 식별자 겸 Tier1 매트릭스 키. (응답은 `AuthorityTeamData`) */
export class CreateAuthorityTeamRequest {
  /** 권한팀 이름(식별자) @example "BLUE" */
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;
}
