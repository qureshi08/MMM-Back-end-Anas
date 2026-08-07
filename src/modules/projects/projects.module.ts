import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

/**
 * No TypeOrmModule.forFeature([Project]) here on purpose — ProjectsService
 * never uses @InjectRepository (see its own comment for why), so there's
 * nothing here that needs it. The entity is still picked up by TypeORM
 * through the glob in database.config.ts regardless.
 */
@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
