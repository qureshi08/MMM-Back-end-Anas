import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ProjectStatus } from '../entities/project.entity';

/**
 * Not PartialType(CreateProjectDto) — status is settable on update
 * (archiving a project) but deliberately never on create, so every new
 * project starts active by the entity's own default, not by a caller
 * choosing otherwise.
 */
export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}
