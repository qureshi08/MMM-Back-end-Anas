import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/** Pulls the verified user off the request. Only valid behind EntraAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    // Non-null: EntraAuthGuard always sets this before a handler runs,
    // on every route that isn't marked @Public(). Don't use @CurrentUser()
    // on a public route — there's nothing to attach.
    return request.user!;
  },
);
