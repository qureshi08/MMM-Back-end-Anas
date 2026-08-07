/**
 * What `request.user` holds during a request, in two phases. EntraAuthGuard
 * sets the first five fields from the verified token (or the dev-bypass
 * fake user) — `tenantId`/`userId` are undefined at that instant.
 * TenantContextInterceptor runs immediately after and fills them in, once
 * TenantResolutionService has found or created the matching rows in our
 * own `tenants`/`users` tables (CMP-42, 2026-08-04). By the time a
 * controller sees this via @CurrentUser(), both are always set — every
 * non-@Public() route goes through both guard and interceptor, in that
 * order, no route can reach a handler with only the first five.
 */
export interface AuthenticatedUser {
  /** Entra object id — stable per-user identifier within their tenant. */
  oid: string;
  /** The Entra (Azure AD) tenant that issued this token. */
  tid: string;
  /** The signed-in user's email/UPN, as Entra reports it. */
  email: string | null;
  /** Display name, if the token carries one. */
  name: string | null;
  /** True only when AUTH_DEV_BYPASS produced this instead of a real token. */
  devBypass: boolean;
  /** Our own `tenants.id` this login resolved to. Unset until TenantContextInterceptor runs. */
  tenantId?: string;
  /** Our own `users.id` this login resolved to. Unset until TenantContextInterceptor runs. */
  userId?: string;
}
