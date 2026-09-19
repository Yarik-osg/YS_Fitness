import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response, CookieOptions } from 'express';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppConfigService } from '../config/app-config.service.js';

@Injectable()
export class CsrfService {
  readonly refreshCookieName: string;
  readonly csrfCookieName: string;
  private readonly allowedOrigins: Set<string>;
  private readonly sameSite: 'strict' | 'lax' | 'none';
  private readonly secure: boolean;
  private readonly secret: string;

  constructor(config: AppConfigService) {
    this.refreshCookieName = config.get('REFRESH_COOKIE_NAME');
    this.csrfCookieName = `${this.refreshCookieName}_csrf`;
    this.sameSite = config.get('COOKIE_SAME_SITE');
    this.secure =
      config.get('NODE_ENV') === 'production' || this.sameSite === 'none';
    this.secret = config.getOrThrow('CSRF_SECRET');
    this.allowedOrigins = new Set(
      config
        .get('WEB_ORIGINS')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    );
  }

  assertTrustedBrowserRequest(request: Request): void {
    const source = request.get('origin') ?? this.originFromReferer(request);

    if (!source || !this.allowedOrigins.has(source)) {
      throw new ForbiddenException({
        code: 'CSRF_ORIGIN_REJECTED',
        message: 'Request origin is not allowed',
      });
    }
  }

  validateCookieRequest(request: Request): void {
    this.assertTrustedBrowserRequest(request);

    if (this.sameSite !== 'none') {
      return;
    }

    const cookieToken = request.cookies?.[this.csrfCookieName] as
      string | undefined;
    const headerToken = request.get('x-csrf-token');

    if (
      !cookieToken ||
      !headerToken ||
      !this.safeEqual(cookieToken, headerToken) ||
      !this.isValidSignedToken(cookieToken)
    ) {
      throw new ForbiddenException({
        code: 'CSRF_TOKEN_INVALID',
        message: 'A valid CSRF token is required',
      });
    }
  }

  setBrowserCookies(
    response: Response,
    refreshToken: string,
    maxAgeMs: number,
  ): void {
    response.cookie(this.refreshCookieName, refreshToken, {
      ...this.baseCookieOptions(maxAgeMs),
      httpOnly: true,
    });

    if (this.sameSite === 'none') {
      response.cookie(
        this.csrfCookieName,
        this.createSignedToken(),
        this.baseCookieOptions(maxAgeMs),
      );
    }
  }

  clearBrowserCookies(response: Response): void {
    const options = this.baseCookieOptions(0);
    response.clearCookie(this.refreshCookieName, options);
    response.clearCookie(this.csrfCookieName, options);
  }

  readCookieToken(request: Request): string {
    const token = request.cookies?.[this.refreshCookieName] as
      string | undefined;

    if (!token) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REQUIRED',
        message: 'Refresh token cookie is missing',
      });
    }

    return token;
  }

  isTrustedOrigin(request: Request): boolean {
    const source = request.get('origin');
    return source ? this.allowedOrigins.has(source) : false;
  }

  private baseCookieOptions(maxAge: number): CookieOptions {
    return {
      secure: this.secure,
      sameSite: this.sameSite,
      path: '/api/v1/auth',
      maxAge,
    };
  }

  private createSignedToken(): string {
    const nonce = randomBytes(32).toString('base64url');
    const signature = createHmac('sha256', this.secret)
      .update(nonce)
      .digest('base64url');
    return `${nonce}.${signature}`;
  }

  private isValidSignedToken(token: string): boolean {
    const [nonce, signature, extra] = token.split('.');
    if (!nonce || !signature || extra) {
      return false;
    }

    const expected = createHmac('sha256', this.secret)
      .update(nonce)
      .digest('base64url');
    return this.safeEqual(signature, expected);
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private originFromReferer(request: Request): string | undefined {
    const referer = request.get('referer');
    if (!referer) {
      return undefined;
    }

    try {
      return new URL(referer).origin;
    } catch {
      return undefined;
    }
  }
}
