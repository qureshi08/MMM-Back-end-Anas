import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';

@Controller('auth')
export class AuthController {
  /**
   * The Postman smoke test for the whole auth pipeline: send a request with
   * a real Entra bearer token (or nothing, while AUTH_DEV_BYPASS=true) and
   * get back exactly what the guard verified, plus the platform tenant and
   * user it resolved to.
   *
   * As of CMP-42 (2026-08-04), that resolution is real: TenantContextInterceptor
   * finds or creates the matching `tenants`/`users` rows before this handler
   * ever runs, per the open-signup decision from the same date. See
   * TenantResolutionService for exactly how a login maps to a tenant.
   */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
