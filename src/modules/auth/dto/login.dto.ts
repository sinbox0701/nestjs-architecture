import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginRequest {
  /** 로그인 이메일 @example "user@example.com" */
  @IsEmail()
  email!: string;

  /** 비밀번호 */
  @IsString()
  @MinLength(8)
  password!: string;
}

class LoginAuthorityTeamData {
  /** 권한팀 ID */
  id!: number;
  /** 권한팀 이름(식별자) @example "BLUE" */
  name!: string;
}

class LoginTeamData {
  /** 소속팀 ID */
  id!: number;
  /** 소속팀 내 역할 @example "LEADER" */
  role!: string;
}

/** 로그인 성공 응답. 토큰은 httpOnly 쿠키로 내려가고, 본문은 인증 주체 요약만 담는다. */
export class LoginResponse {
  /** 사용자 ID */
  id!: number;
  authorityTeam!: LoginAuthorityTeamData;
  team!: LoginTeamData;
}
