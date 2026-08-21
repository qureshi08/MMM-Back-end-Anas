import { IsEmail } from 'class-validator';

/** No role field, deliberately — project membership only grants visibility. What a member can do
 * once they can see the project still comes from their existing tenant-wide GlobalRole. */
export class AddProjectMemberDto {
  @IsEmail()
  email: string;
}
