import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../../modules/auth/interfaces/authenticated-user.interface';
import { GlobalRole } from '../../modules/users/entities/user.entity';

/**
 * The real 3-tier permission spec, Anas 2026-08-20: Master can do anything. Read/Write can view
 * and create/edit/train/delete projects and datasets, but not manage members. Read can view
 * everything and change nothing.
 *
 * Checked in controllers rather than a Guard, deliberately — `globalRole` only exists on
 * `request.user` once TenantContextInterceptor has run, and interceptors run after all guards in
 * Nest's pipeline, so a Guard here would always see it undefined. Controllers already have the
 * fully-populated `AuthenticatedUser` via `@CurrentUser()`, so the check happens there instead.
 */
export function assertWriteAccess(user: AuthenticatedUser): void {
  if (user.globalRole === GlobalRole.READ) {
    throw new ForbiddenException('Your role only allows viewing. Ask a Master for Read/Write access.');
  }
}
