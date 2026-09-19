import { CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CsrfService } from './csrf.service.js';

@Injectable()
export class CookieCsrfGuard implements CanActivate {
  constructor(private readonly csrf: CsrfService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.cookies?.[this.csrf.refreshCookieName]) {
      this.csrf.validateCookieRequest(request);
    }

    return true;
  }
}
