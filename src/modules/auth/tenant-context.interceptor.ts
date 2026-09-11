import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
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
 * it's committed and released.
 *
 * Real bug, found live 2026-09-11: this used to roll back on *any* thrown
 * error, no exceptions. OtpService.verifyCode does a real, intentional write
 * — incrementing the attempt count — specifically so a wrong guess counts
 * against the real 5-try limit, then throws a normal UnauthorizedException to
 * tell the client "incorrect code." That throw rolled back the whole
 * transaction, undoing the increment right along with it — so `attempts`
 * silently reset to its pre-request value on every single wrong guess, and
 * the real limit could never be reached. Confirmed live: attemptsRemaining
 * stuck at the same number across separate requests, seconds apart.
 *
 * A normal `HttpException` (4xx) is the route handler correctly rejecting a
 * request it fully understood — real writes made before that point were
 * deliberate, and now commit instead of vanishing. Only a genuinely
 * unexpected failure (a non-HttpException, or a real 5xx) still rolls back,
 * since that's the actual "half-provisioned tenant" case this comment used
 * to describe — an error nobody planned for, not an intentional 401.
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
          const isExpectedRejection = error instanceof HttpException && error.getStatus() < 500;
          if (isExpectedRejection) {
            await queryRunner.commitTransaction().catch(() => undefined);
          } else {
            await queryRunner.rollbackTransaction().catch(() => undefined);
          }
          subscriber.error(error);
        } finally {
          await queryRunner.release();
        }
      })();
    });
  }
}
