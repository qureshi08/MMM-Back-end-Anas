import { IsEmail, IsEnum } from 'class-validator';
import { GlobalRole } from '../entities/user.entity';

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsEnum(GlobalRole)
  role: GlobalRole;
}
