import { AuthenticatedUser } from '../modules/auth/interfaces/authenticated-user.interface';

/**
 * EntraAuthGuard attaches the verified user here. Declared globally so every
 * controller sees a typed `request.user` without each one re-importing this.
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
