import { IsNumber, Max, Min } from 'class-validator';

/** The Calibrate screen's real fields, matching `model_configuration.calibration`. */
export class CalibrateDatasetDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  contributionBeliefPercent: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  confidencePercent: number;
}
