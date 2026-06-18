import { IsEmail, IsEnum, IsInt, IsString, MinLength } from 'class-validator';

import { TeamRole } from '../enum/team-role.enum';

/** 사용자 생성 요청. (응답은 `UserData` — get-user.dto.ts) */
export class CreateUserRequest {
  /** 로그인 이메일 @example "user@example.com" */
  @IsEmail()
  email!: string;

  /** 초기 비밀번호 (서버에서 argon2 해싱) */
  @IsString()
  @MinLength(8)
  password!: string;

  /** 이름 */
  @IsString()
  @MinLength(1)
  name!: string;

  /** 소속팀 ID */
  @IsInt()
  teamId!: number;

  /** 소속팀 내 역할 */
  @IsEnum(TeamRole)
  role!: TeamRole;
}
