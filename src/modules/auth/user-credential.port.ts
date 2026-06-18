import { GlobalRole } from '@/lib/access-control';

/**
 * 로그인/refresh 시 Access Token 클레임을 구성하기 위한 사용자 인증 정보.
 * (auth 모듈은 User 엔티티를 모른다 — 이 형태만 안다.)
 */
export interface AuthIdentity {
  id: number;
  globalRoles: GlobalRole[];
  authorityTeam: { id: number; name: string }; // 권한팀 (Red/Blue…) name이 Tier1 매트릭스 키
  team: { id: number; role: string }; // 소속팀 + 역할(LEADER/MEMBER) → Tier2
}

/**
 * auth 모듈이 User 모듈에 의존하지 않도록 하는 포트(DIP).
 * User 모듈(Phase B)이 이 인터페이스를 구현해 `USER_CREDENTIAL_PORT` 토큰에 바인딩한다.
 */
export interface UserCredentialPort {
  /** 이메일+비밀번호 검증. 실패 시 null. (비밀번호 해싱 검증은 User 모듈 책임) */
  validateCredentials(email: string, password: string): Promise<AuthIdentity | null>;
  /** userId로 최신 인증 정보 조회 (refresh 시 AT 클레임 재구성용). 없으면 null. */
  getIdentity(userId: number): Promise<AuthIdentity | null>;
}

export const USER_CREDENTIAL_PORT = Symbol('USER_CREDENTIAL_PORT');
