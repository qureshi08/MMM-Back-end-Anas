import { ArrayMinSize, IsArray, IsString } from 'class-validator';

/** The Optimize screen's "combine similar channels" chart, done for real instead of client-side. */
export class CombineColumnsDto {
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  columns: string[];
}
