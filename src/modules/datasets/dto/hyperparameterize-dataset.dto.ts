import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, Max, Min, MinLength, IsString, ValidateNested } from 'class-validator';

/** One channel's real settings, matching an entry in `model_configuration.channels`. */
export class ChannelHyperparameterDto {
  @IsString()
  @MinLength(1)
  channel: string;

  /** 0 to 1: how much of this week's spend is still influencing next week (adstock decay). */
  @IsNumber()
  @Min(0)
  @Max(1)
  carryover: number;

  /** How quickly this channel's effect flattens out as spend increases. No fixed upper bound. */
  @IsNumber()
  @Min(0)
  saturation: number;
}

/** The Hyperparameterization screen's real field, matching `model_configuration.channels`. */
export class HyperparameterizeDatasetDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChannelHyperparameterDto)
  channels: ChannelHyperparameterDto[];
}
