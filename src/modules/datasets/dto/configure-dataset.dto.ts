import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { KpiType } from '../entities/dataset.entity';

/** The Configure screen's real fields, matching Hammad's `column_mapping` + `kpi_type`. */
export class ConfigureDatasetDto {
  @IsString()
  @MinLength(1)
  dateColumn: string;

  @IsString()
  @MinLength(1)
  targetColumn: string;

  @IsEnum(KpiType)
  kpiType: KpiType;

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
}
