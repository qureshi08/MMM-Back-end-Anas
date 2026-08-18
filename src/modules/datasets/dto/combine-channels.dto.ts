import { ArrayMinSize, IsArray, IsString, Matches } from 'class-validator';

/**
 * The real "combine similar channels" decision, applied to the actual job file Assembly builds —
 * not just the Optimize preview chart. See `ChannelCombination` on the entity for why this exists.
 */
export class CombineChannelsDto {
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  sourceColumns: string[];

  @IsString()
  @Matches(/^[^\s]+$/, { message: 'newColumnName cannot contain spaces.' })
  newColumnName: string;
}
