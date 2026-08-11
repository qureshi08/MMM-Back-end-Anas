import { Module } from '@nestjs/common';
import { DatasetsController } from './datasets.controller';
import { DatasetsService } from './datasets.service';
import { storageServiceProvider } from './storage/storage.provider';

/**
 * No `TypeOrmModule.forFeature([Dataset])`, same reasoning as
 * `ProjectsModule`: `DatasetsService` never uses `@InjectRepository`, and
 * the entity is still picked up by TypeORM through the glob in
 * `database.config.ts`.
 */
@Module({
  controllers: [DatasetsController],
  providers: [DatasetsService, storageServiceProvider],
})
export class DatasetsModule {}
