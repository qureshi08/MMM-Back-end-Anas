import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { OtpService } from './otp.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

/**
 * Both routes require a real, already-verified Entra sign-in (neither is
 * `@Public()`) — this is a second factor layered on top of Microsoft
 * login, not a replacement for it. `user.userId`/`user.tenantId` are
 * already resolved by the time either handler runs.
 */
@Controller('auth/otp')
export class OtpController {
  constructor(private readonly otp: OtpService) {}

  @Post('request')
  @HttpCode(HttpStatus.ACCEPTED)
  request(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.otp.requestCode(user);
  }

  @Post('verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  verify(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyOtpDto): Promise<void> {
    return this.otp.verifyCode(user, dto.code);
  }
}
