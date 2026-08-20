import { Module } from '@nestjs/common';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';
import { MailModule } from '../../common/mail/mail.module';
import { OtpVerifiedInterceptor } from './otp-verified.interceptor';

/**
 * No `TypeOrmModule.forFeature([OtpCode])`, same reasoning as every other
 * RLS-protected module — `OtpService` never uses `@InjectRepository`.
 */
@Module({
  imports: [MailModule],
  controllers: [OtpController],
  providers: [OtpService, OtpVerifiedInterceptor],
  exports: [OtpVerifiedInterceptor],
})
export class OtpModule {}
