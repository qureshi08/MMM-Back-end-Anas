import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MailModule } from '../../common/mail/mail.module';

/**
 * No `TypeOrmModule.forFeature([...])` — `UsersService` is RLS-protected,
 * same reasoning as every other tenant-owned module, it never uses
 * `@InjectRepository`.
 */
@Module({
  imports: [MailModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
