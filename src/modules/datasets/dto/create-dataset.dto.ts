import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * No `modelType` field — corrected 2026-08-11, see `ModelType`'s own
 * comment in `dataset.entity.ts`. There's one real engine, not a choice a
 * caller makes.
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
}
