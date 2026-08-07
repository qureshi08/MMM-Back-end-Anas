import { AsyncLocalStorage } from 'node:async_hooks';
import { QueryRunner } from 'typeorm';

/**
 * Carries the current request's tenant-scoped database session across
 * whatever async code runs during that request, without threading a
 * parameter through every service and repository call by hand.
 *
 * Deliberately AsyncLocalStorage, not a NestJS request-scoped provider —
 * request scope re-instantiates the entire provider graph on every single
 * request, which is a real, measurable cost. AsyncLocalStorage does the
 * same job (per-request isolated state) without that overhead.
 */
export interface TenantContext {
  tenantId: string;
  queryRunner: QueryRunner;
}

const storage = new AsyncLocalStorage<TenantContext>();

/** Only called by TenantContextInterceptor — nowhere else should need this. */
export function runWithTenantContext<T>(context: TenantContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(context, fn);
}

/**
 * Services use this instead of @InjectRepository when the query needs to
 * respect Row-Level Security — it returns the same QueryRunner the
 * interceptor already ran `SET LOCAL app.tenant_id` on for this request.
 * Throws if called outside a request that went through the interceptor,
 * on purpose: a tenant-scoped query with no tenant context is a bug, not
 * something to silently fall back on.
 */
export function getTenantContext(): TenantContext {
  const context = storage.getStore();
  if (!context) {
    throw new Error(
      'No tenant context available. This code path needs to run behind ' +
        'TenantContextInterceptor, or it is trying to do a tenant-scoped ' +
        'query outside of a request entirely.',
    );
  }
  return context;
}
