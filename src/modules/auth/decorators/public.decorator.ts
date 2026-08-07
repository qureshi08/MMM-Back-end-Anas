import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Every route is protected by default (see EntraAuthGuard, registered
 * globally in AuthModule) — mark the few that genuinely aren't:
 * the health check, the Marketplace webhook (which arrives from Microsoft,
 * not a signed-in user).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
