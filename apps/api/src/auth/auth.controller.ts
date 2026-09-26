import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AuthResponse } from '@repo/shared-types';
import { AuthService, type IssuedAuthResponse } from './auth.service.js';
import { LoginDto, LogoutDto, RefreshDto, RegisterDto } from './auth.dto.js';
import { CsrfService } from './csrf.service.js';
import { CookieCsrfGuard } from './cookie-csrf.guard.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly csrf: CsrfService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(
    @Body() input: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    this.validateTransport(input.clientType, request);
    const result = await this.auth.register(input, request);
    return this.applyTransport(result, input.clientType, response);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    this.validateTransport(input.clientType, request);
    const result = await this.auth.login(input, request);
    return this.applyTransport(result, input.clientType, response);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CookieCsrfGuard)
  async refresh(
    @Body() input: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    this.validateTransport(input.clientType, request);
    const token =
      input.clientType === 'WEB'
        ? this.csrf.readCookieToken(request)
        : this.requireBodyToken(input.refreshToken);
    const result = await this.auth.refresh(token, input.clientType);
    return this.applyTransport(result, input.clientType, response);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(CookieCsrfGuard)
  async logout(
    @Body() input: LogoutDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.validateTransport(input.clientType, request);
    const token =
      input.clientType === 'WEB'
        ? this.csrf.readCookieToken(request)
        : this.requireBodyToken(input.refreshToken);

    await this.auth.logout(token);
    if (input.clientType === 'WEB') {
      this.csrf.clearBrowserCookies(response);
    }
  }

  private applyTransport(
    result: IssuedAuthResponse,
    clientType: 'WEB' | 'MOBILE',
    response: Response,
  ): AuthResponse {
    if (clientType === 'WEB' && result.refreshToken) {
      this.csrf.setBrowserCookies(
        response,
        result.refreshToken,
        result.refreshMaxAgeMs,
      );
    }

    return {
      user: result.user,
      tokens: {
        ...result.tokens,
        ...(clientType === 'MOBILE' && result.refreshToken
          ? { refreshToken: result.refreshToken }
          : {}),
      },
    };
  }

  private validateTransport(
    clientType: 'WEB' | 'MOBILE',
    request: Request,
  ): void {
    const hasBrowserOrigin = Boolean(
      request.get('origin') ?? request.get('referer'),
    );

    if (clientType === 'MOBILE' && hasBrowserOrigin) {
      throw new BadRequestException({
        code: 'INVALID_TOKEN_TRANSPORT',
        message: 'Browser requests cannot receive refresh tokens in the body',
      });
    }

    if (clientType === 'WEB' && hasBrowserOrigin) {
      this.csrf.assertTrustedBrowserRequest(request);
    }
  }

  private requireBodyToken(token?: string): string {
    if (!token) {
      throw new BadRequestException({
        code: 'REFRESH_TOKEN_REQUIRED',
        message: 'refreshToken is required for mobile clients',
      });
    }
    return token;
  }
}
