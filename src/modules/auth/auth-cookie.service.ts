import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CookieOptions, Response } from 'express';

import { parseDurationToSeconds } from '@/common/utils/time.util';

import { AUTH_COOKIE } from './auth.constants';

/**
 * 인증 토큰을 httpOnly 쿠키로 전달/제거한다. (localStorage 금지 — XSS 방지)
 * Secure/SameSite/Domain은 `auth.*` config(prod/stage 하드닝 게이트 적용)에서 읽는다.
 */
@Injectable()
export class AuthCookieService {
  constructor(private readonly configService: ConfigService) {}

  private baseOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.configService.get<boolean>('auth.cookieSecure', false),
      sameSite: this.configService.get<CookieOptions['sameSite']>('auth.cookieSameSite', 'lax'),
      domain: this.configService.get<string>('auth.cookieDomain') || undefined,
      path: '/',
    };
  }

  setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const accessMaxAge = parseDurationToSeconds(this.configService.getOrThrow<string>('auth.jwtExpiresIn')) * 1000;
    const refreshMaxAge = parseDurationToSeconds(this.configService.getOrThrow<string>('auth.refreshExpiresIn')) * 1000;
    res.cookie(AUTH_COOKIE.ACCESS, accessToken, { ...this.baseOptions(), maxAge: accessMaxAge });
    res.cookie(AUTH_COOKIE.REFRESH, refreshToken, { ...this.baseOptions(), maxAge: refreshMaxAge });
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie(AUTH_COOKIE.ACCESS, this.baseOptions());
    res.clearCookie(AUTH_COOKIE.REFRESH, this.baseOptions());
  }
}
