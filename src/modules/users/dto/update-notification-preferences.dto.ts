import { IsBoolean, IsOptional } from 'class-validator';

/** Partial on purpose — the frontend only sends the one toggle that changed. */
export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  runCompleted?: boolean;

  @IsOptional()
  @IsBoolean()
  runFailed?: boolean;

  @IsOptional()
  @IsBoolean()
  weeklyDigest?: boolean;
}
