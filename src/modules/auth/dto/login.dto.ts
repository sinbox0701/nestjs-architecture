import { IsEmail, IsString, MinLength } from 'class-validator';

import { AuthIdentity } from '../user-credential.port';

export class LoginRequest {
  /** 로그인 이메일 @example "user@example.com" */
  @IsEmail()
  email!: string;

  /** 비밀번호 */
  @IsString()
  @MinLength(8)
  password!: string;
}

class LoginRoleData {
  /** 역할 ID */
  id!: number;
  /** 역할 이름(식별자) @example "BLUE" */
  name!: string;
}

class LoginTeamData {
  /** 소속팀 ID */
  id!: number;
  /** 소속팀 내 직위 @example "LEADER" */
  position!: string;
}

/** 로그인 성공 응답. 토큰은 httpOnly 쿠키로 내려가고, 본문은 인증 주체 요약만 담는다. */
export class LoginResponse {
  /** 사용자 ID */
  id!: number;
  role!: LoginRoleData;
  team!: LoginTeamData;

  /** AuthIdentity → 응답 매핑(컨트롤러가 도메인 구조를 직접 재조립하지 않도록 DTO가 책임진다). */
  static from(identity: AuthIdentity): LoginResponse {
    return {
      id: identity.id,
      role: { id: identity.role.id, name: identity.role.name },
      team: { id: identity.team.id, position: identity.team.position },
    };
  }
}
