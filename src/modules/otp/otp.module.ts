import { Module } from '@nestjs/common';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';
import { graphMailServiceProvider } from './mail/graph-mail.provider';
import { OtpVerifiedInterceptor } from './otp-verified.interceptor';

/**
 * No `TypeOrmModule.forFeature([OtpCode])`, same reasoning as every other
 * RLS-protected module — `OtpService` never uses `@InjectRepository`.
 */
@Module({
  controllers: [OtpController],
  providers: [OtpService, graphMailServiceProvider, OtpVerifiedInterceptor],
  exports: [OtpVerifiedInterceptor],
})
export class OtpModule {}
