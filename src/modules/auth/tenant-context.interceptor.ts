import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { runWithTenantContext } from '../../common/tenant/tenant-context';
import { TenantResolutionService } from './tenant-resolution.service';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';

/**
 * Runs right after EntraAuthGuard, for every non-@Public() route. The guard
 * only proves *who* signed in; this is where that gets turned into *which
 * tenant and platform user*, and where the rest of the request gets a
 * database session with Row-Level Security actually switched on for them.
 *
 * One QueryRunner per request, in one transaction: opened here, provisioning
 * runs on it, the route handler runs on it (via AsyncLocalStorage), then
 * it's committed and released. A request that throws rolls back instead of
 * partially committing a half-provisioned tenant.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tenantResolution: TenantResolutionService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;

    // @Public() routes never had EntraAuthGuard attach a user — nothing to
    // resolve, and no tenant-scoped query should happen on one anyway.
    if (!user) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      void (async () => {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          const { tenantId, userId, globalRole } = await this.tenantResolution.resolveOrProvision(
            user,
            queryRunner.manager,
          );
          request.user = { ...user, tenantId, userId, globalRole } satisfies AuthenticatedUser;

          await runWithTenantContext(
            { tenantId, queryRunner },
            () =>
              new Promise<void>((resolve, reject) => {
                next.handle().subscribe({
                  next: (value) => subscriber.next(value),
                  error: reject,
                  complete: () => resolve(),
                });
              }),
          );

          await queryRunner.commitTransaction();
          subscriber.complete();
        } catch (error) {
          await queryRunner.rollbackTransaction().catch(() => undefined);
          subscriber.error(error);
        } finally {
          await queryRunner.release();
        }
      })();
    });
  }
}
