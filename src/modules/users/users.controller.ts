import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('members')
  listMembers() {
    return this.users.listMembers();
  }

  @Get('members/invites')
  listPendingInvites() {
    return this.users.listPendingInvites();
  }

  @Post('members/invite')
  inviteMember(@CurrentUser() user: AuthenticatedUser, @Body() dto: InviteMemberDto) {
    return this.users.inviteMember(user.tenantId!, user.userId!, dto);
  }

  @Patch('members/:id/role')
  updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.users.updateMemberRole(user.userId!, id, dto);
  }

  @Delete('members/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.removeMember(user.userId!, id);
  }

  @Get('me/notification-preferences')
  getNotificationPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getNotificationPreferences(user.userId!);
  }

  @Patch('me/notification-preferences')
  updateNotificationPreferences(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateNotificationPreferencesDto) {
    return this.users.updateNotificationPreferences(user.userId!, dto);
  }
}
