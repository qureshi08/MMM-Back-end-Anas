import { IsDateString } from 'class-validator';

/** The Optimize screen's real field: the date range the training run actually uses. */
export class OptimizeDatasetDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
