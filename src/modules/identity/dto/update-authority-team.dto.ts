import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** 권한팀 수정 요청. */
export class UpdateAuthorityTeamRequest {
  /** 권한팀 이름(식별자) */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;
}
