import { Module } from '@nestjs/common';

import { IdentityModule } from '@/modules/identity/identity.module';

import { AuthController } from './auth.controller';
import { AuthService } from './service/auth.service';
import { AuthCookieService } from './service/auth-cookie.service';
import { TokenService } from './service/token.service';
import { RefreshTokenStore } from './store/refresh-token.store';
import { SessionEpochStore } from './store/session-epoch.store';

/**
 * 인증 모듈 (login/refresh/logout).
 *
 * `USER_CREDENTIAL_PORT`(자격 검증)는 User 모듈이 구현한다 — 이 모듈을 AppModule에 등록할 때
 * 포트를 제공하는 모듈(UserModule)을 함께 import해야 한다. (Phase B에서 배선)
 *
 * JwtModule(global)·ConfigModule(global)·RedisClient(@Global)에 의존하므로 별도 import 불필요.
 */
@Module({
  imports: [IdentityModule], // USER_CREDENTIAL_PORT 제공
  controllers: [AuthController],
  providers: [AuthService, TokenService, RefreshTokenStore, SessionEpochStore, AuthCookieService],
  // SessionEpochStore: 도메인이 권한 회수/추방 시 revokeAll로 사용자 세션을 무효화하는 훅.
  exports: [TokenService, SessionEpochStore],
})
export class AuthModule {}
