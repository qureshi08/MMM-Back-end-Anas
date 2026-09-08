import { IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * The Calibrate screen's real fields, matching `model_configuration.calibration`. Genuinely
 * optional per Hammad's real contract, confirmed 2026-09-08: a real belief is "either provide
 * both, or neither" — never just one. That cross-field rule can't be expressed by these two
 * decorators alone (each field only knows about itself), so it's enforced in
 * `assertCalibrationBothOrNeither()` at the service layer, the same real pattern
 * `assertRevenuePerKpiValueMatchesKpiType` already uses for the same shape of rule.
 */
export class CalibrateDatasetDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  contributionBeliefPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  confidencePercent?: number;
}
