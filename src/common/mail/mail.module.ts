import { Module } from '@nestjs/common';
import { graphMailServiceProvider } from './graph-mail.provider';
import { NotificationService } from './notification.service';

/**
 * Shared home for `GraphMailService`, moved out of `otp/` 2026-08-19 — it's
 * no longer OTP-specific, member invites and training-complete/failed
 * notifications reuse the exact same Graph app registration and `sendMail`
 * call. Any module that needs to send real mail imports this one.
 */
@Module({
  providers: [graphMailServiceProvider, NotificationService],
  exports: [graphMailServiceProvider, NotificationService],
})
export class MailModule {}
