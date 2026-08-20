import { IsEnum } from 'class-validator';
import { GlobalRole } from '../entities/user.entity';

export class UpdateMemberRoleDto {
  @IsEnum(GlobalRole)
  role: GlobalRole;
}
