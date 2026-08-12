import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { KpiType } from '../entities/dataset.entity';

/**
 * The Configure screen's real fields, matching Hammad's `column_mapping` + `kpi_type` +
 * `revenue_per_kpi_value`. `geoColumns` and `revenuePerKpiValue` added 2026-08-12: both real,
 * required fields in Hammad's own API Contracts document that Configure never collected before.
 */
export class ConfigureDatasetDto {
  @IsString()
  @MinLength(1)
  dateColumn: string;

  @IsString()
  @MinLength(1)
  targetColumn: string;

  @IsEnum(KpiType)
  kpiType: KpiType;

  /**
   * Hammad's contract: "required only if kpi_type is non_revenue; otherwise null." Enforced in
   * DatasetsService.configure(), not here, since it depends on the value of another field.
   */
  @IsOptional()
  @IsNumber()
  revenuePerKpiValue?: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  mediaColumns: string[];

  @IsArray()
  @IsString({ each: true })
  controlColumns: string[];

  /** Non-paid channels, if the caller has any. Genuinely optional, unlike the fields above it. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  organicColumns?: string[];

  /** Geographic breakdown columns, if the dataset has any. Genuinely optional. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  geoColumns?: string[];
}
