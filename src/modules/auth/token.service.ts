import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';

import { randomUUID } from 'crypto';

import { TeamMembership } from '@/lib/access-control';

import { AuthIdentity } from './user-credential.port';

/** Access Token 페이로드 (AuthGuard가 읽어 AuthSubject로 주입). */
interface AccessTokenPayload {
  sub: number;
  jti: string;
  globalRoles: AuthIdentity['globalRoles'];
  teams: TeamMembership[];
  authorityTeam: AuthIdentity['authorityTeam'];
}

/** Refresh Token 페이로드. family 단위로 rotation/재사용 탐지. */
export interface RefreshTokenPayload {
  sub: number;
  family: string;
  jti: string;
  typ: 'refresh';
}

/**
 * JWT 발급/검증. Access Token은 모듈 기본 시크릿(HS256), Refresh Token은 분리된 시크릿을 쓴다.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /** Access Token 발급. 반환된 jti는 강제 로그아웃 blocklist 키로 쓰인다. */
  async signAccessToken(identity: AuthIdentity): Promise<{ token: string; jti: string }> {
    const jti = randomUUID();
    const payload: AccessTokenPayload = {
      sub: identity.id,
      jti,
      globalRoles: identity.globalRoles,
      teams: [{ teamId: identity.team.id, role: identity.team.role }],
      authorityTeam: identity.authorityTeam,
    };
    const token = await this.jwtService.signAsync(payload); // 모듈 기본: secret + JWT_EXPIRES_IN + HS256
    return { token, jti };
  }

  /** Access Token 검증 (logout 시 jti 추출용). 만료/위조면 throw. */
  verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwtService.verifyAsync<AccessTokenPayload>(token);
  }

  /** Refresh Token 발급. */
  signRefreshToken(userId: number, family: string, jti: string): Promise<string> {
    const payload: RefreshTokenPayload = { sub: userId, family, jti, typ: 'refresh' };
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('auth.refreshSecret'),
      expiresIn: this.configService.getOrThrow<string>('auth.refreshExpiresIn') as JwtSignOptions['expiresIn'],
      algorithm: 'HS256',
    });
  }

  /** Refresh Token 검증. 만료/위조면 throw. */
  verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    return this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
      secret: this.configService.getOrThrow<string>('auth.refreshSecret'),
      algorithms: ['HS256'],
    });
  }
}
