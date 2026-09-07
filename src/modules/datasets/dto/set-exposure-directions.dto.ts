import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsString, MinLength, ValidateNested } from 'class-validator';
import { ExposureDirection } from '../entities/dataset.entity';

const EXPOSURE_DIRECTIONS: ExposureDirection[] = ['helps', 'hurts', 'not_sure'];

export class ExposureDirectionChoiceDto {
  @IsString()
  @MinLength(1)
  column: string;

  @IsEnum(EXPOSURE_DIRECTIONS)
  direction: ExposureDirection;
}

/** The Exposure Metrics screen's real "Save and continue" — the user's chosen direction per column. */
export class SetExposureDirectionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExposureDirectionChoiceDto)
  directions: ExposureDirectionChoiceDto[];
}
