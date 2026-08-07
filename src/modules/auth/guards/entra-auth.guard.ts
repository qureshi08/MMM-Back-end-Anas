import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { ENTRA_JWT_VERIFIER, EntraJwtVerifierProvider } from '../entra-jwt-verifier.provider';
import { ConfigService } from '@nestjs/config';

/**
 * Every route is protected by default. A controller opts *out* with
 * @Public(), not the other way round — the safe default for a multi-tenant
 * SaaS API is "prove who you are", not "forget to lock this one".
 */
@Injectable()
export class EntraAuthGuard implements CanActivate {
  private readonly logger = new Logger(EntraAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    @Inject(ENTRA_JWT_VERIFIER) private readonly verifier: EntraJwtVerifierProvider,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    if (this.config.get<boolean>('AUTH_DEV_BYPASS')) {
      request.user = this.devUser();
      return true;
    }

    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing or malformed Authorization header.');
    }

    try {
      const payload = await this.verifier.verify(token);
      request.user = {
        oid: String(payload.oid ?? payload.sub ?? ''),
        tid: String(payload.tid ?? ''),
        email: (payload.preferred_username as string) ?? (payload.upn as string) ?? null,
        name: (payload.name as string) ?? null,
        devBypass: false,
      } satisfies AuthenticatedUser;
      return true;
    } catch (error) {
      this.logger.debug(`Token rejected: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }

  private extractBearerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return null;
    }
    const token = header.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
  }

  private devUser(): AuthenticatedUser {
    return {
      oid: 'dev-bypass-oid',
      tid: 'dev-bypass-tid',
      email: 'dev@local.test',
      name: 'Local Dev User (AUTH_DEV_BYPASS)',
      devBypass: true,
    };
  }
}
