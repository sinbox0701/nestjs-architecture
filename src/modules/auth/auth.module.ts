import { Module } from '@nestjs/common';

import { IdentityModule } from '@/modules/identity/identity.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthCookieService } from './auth-cookie.service';
import { RefreshTokenStore } from './refresh-token.store';
import { TokenService } from './token.service';

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
  providers: [AuthService, TokenService, RefreshTokenStore, AuthCookieService],
  exports: [TokenService],
})
export class AuthModule {}
