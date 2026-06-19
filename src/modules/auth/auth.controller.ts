import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';

import { Request, Response } from 'express';

import { ApiDataResponse, R } from '@/common/base/response';
import { Public } from '@/common/decorators/auth-public.decorator';

import { AUTH_COOKIE } from './auth.constants';
import { AuthService, IssuedTokens } from './auth.service';
import { AuthCookieService } from './auth-cookie.service';
import { LoginRequest, LoginResponse } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookies: AuthCookieService,
  ) {}

  /** 로그인. 성공 시 AT/RT를 httpOnly 쿠키로 내리고 인증 주체 요약을 반환한다. */
  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiDataResponse(LoginResponse)
  async login(@Body() body: LoginRequest, @Res({ passthrough: true }) res: Response) {
    const issued = await this.authService.login(body.email, body.password);
    this.setCookies(res, issued);
    return R.data(this.toResponse(issued));
  }

  /** Access Token 재발급. RT 쿠키를 검증·회전(rotation)하고 새 AT/RT를 내린다. */
  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiDataResponse(LoginResponse)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const issued = await this.authService.refresh(req.cookies?.[AUTH_COOKIE.REFRESH]);
    this.setCookies(res, issued);
    return R.data(this.toResponse(issued));
  }

  /** 로그아웃. AT를 blocklist에 등록하고 RT family를 폐기, 쿠키를 제거한다. (멱등) */
  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.cookies?.[AUTH_COOKIE.ACCESS], req.cookies?.[AUTH_COOKIE.REFRESH]);
    this.cookies.clearAuthCookies(res);
    return R.empty();
  }

  private setCookies(res: Response, issued: IssuedTokens): void {
    this.cookies.setAuthCookies(res, issued.accessToken, issued.refreshToken);
  }

  private toResponse(issued: IssuedTokens): LoginResponse {
    const { identity } = issued;
    return {
      id: identity.id,
      role: { id: identity.role.id, name: identity.role.name },
      team: { id: identity.team.id, position: identity.team.position },
    };
  }
}
