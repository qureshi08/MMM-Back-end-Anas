import { Module } from '@nestjs/common';
import { DatasetsController } from './datasets.controller';
import { DatasetsService } from './datasets.service';
import { storageServiceProvider } from './storage/storage.provider';
import { MailModule } from '../../common/mail/mail.module';
import { UsersModule } from '../users/users.module';
import { ProjectsModule } from '../projects/projects.module';

/**
 * No `TypeOrmModule.forFeature([Dataset])`, same reasoning as
 * `ProjectsModule`: `DatasetsService` never uses `@InjectRepository`, and
 * the entity is still picked up by TypeORM through the glob in
 * `database.config.ts`. `MailModule`/`UsersModule` added 2026-08-19 for
 * real training-complete/failed emails. `ProjectsModule` added 2026-08-20 —
 * every dataset read/write now checks real access to its parent project via
 * `ProjectsService.assertAccessById`, a project's privacy is only as real
 * as its datasets' privacy too.
 */
@Module({
  imports: [MailModule, UsersModule, ProjectsModule],
  controllers: [DatasetsController],
  providers: [DatasetsService, storageServiceProvider],
})
export class DatasetsModule {}
