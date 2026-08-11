import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { ModelType } from '../entities/dataset.entity';

/**
 * `modelType` is real and caller-supplied, confirmed 2026-08-11: a
 * dropdown, same structure as Cassandra's, built to scale to more models
 * later even though `ModelType` only has one real value today. See that
 * enum's own comment for the two earlier, corrected assumptions.
 *
 * The file itself arrives via `@UploadedFile()`, not this DTO — multipart
 * form fields still validate through the usual `ValidationPipe`, Nest binds
 * multer's parsed text fields onto `@Body()` exactly like a JSON body.
 */
export class CreateDatasetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsEnum(ModelType)
  modelType: ModelType;
}
