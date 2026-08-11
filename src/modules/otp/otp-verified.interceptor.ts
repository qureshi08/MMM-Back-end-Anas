import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { MoreThan } from 'typeorm';
import { getTenantContext } from '../../common/tenant/tenant-context';
import { OtpCode } from './entities/otp-code.entity';

/** How long a completed code verification counts as "still verified." */
const VERIFIED_WINDOW_HOURS = 12;

/**
 * Not built as a Guard on purpose: Guards run before Interceptors, so a
 * Guard here would fire before `TenantContextInterceptor` has opened the
 * tenant-scoped `QueryRunner` this needs to query `otp_codes` at all. This
 * has to run as an Interceptor registered *after* `TenantContextInterceptor`
 * (`@UseInterceptors(TenantContextInterceptor, OtpVerifiedInterceptor)`, in
 * that order) so tenant context already exists by the time it runs.
 *
 * Deliberately not applied to any route yet (2026-08-11): Amna's frontend
 * has no code-entry screen built yet, so gating real routes behind this
 * now would strand every signed-in user with no way to get past it.
 * Available for whichever routes need it once that screen exists.
 */
@Injectable()
export class OtpVerifiedInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const { tenantId, queryRunner } = getTenantContext();
    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.userId;

    const repo = queryRunner.manager.getRepository(OtpCode);
    const recentlyVerified = await repo.findOne({
      where: {
        tenantId,
        userId,
        consumedAt: MoreThan(new Date(Date.now() - VERIFIED_WINDOW_HOURS * 60 * 60_000)),
      },
      order: { consumedAt: 'DESC' },
    });

    if (!recentlyVerified) {
      throw new ForbiddenException('Verification code required. Call POST /auth/otp/request, then verify.');
    }

    return next.handle();
  }
}
