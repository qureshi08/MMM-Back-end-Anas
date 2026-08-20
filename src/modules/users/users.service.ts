import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { getTenantContext } from '../../common/tenant/tenant-context';
import { GlobalRole, User, DEFAULT_NOTIFICATION_PREFERENCES, NotificationPreferences } from './entities/user.entity';
import { TenantInvite } from '../tenants/entities/tenant-invite.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { NotificationService } from '../../common/mail/notification.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

/**
 * `users` has Row-Level Security, same reasoning as every other tenant-owned table — real requests
 * go through the per-request tenant-scoped `QueryRunner`, never `@InjectRepository`. Previously
 * this service used `@InjectRepository` directly and was never actually called from anywhere —
 * fixed while building real member management, 2026-08-19, before that RLS gap got copied into a
 * real feature.
 */
@Injectable()
export class UsersService {
  constructor(private readonly notifications: NotificationService) {}

  private repo() {
    return getTenantContext().queryRunner.manager.getRepository(User);
  }

  private invitesRepo() {
    return getTenantContext().queryRunner.manager.getRepository(TenantInvite);
  }

  private tenantsRepo() {
    return getTenantContext().queryRunner.manager.getRepository(Tenant);
  }

  findByTenantAndEmail(tenantId: string, email: string): Promise<User | null> {
    return this.repo().findOne({ where: { tenantId, email } });
  }

  findById(id: string): Promise<User | null> {
    return this.repo().findOne({ where: { id } });
  }

  /** Real tenant members, per the users table RLS already scopes to. */
  listMembers(): Promise<User[]> {
    return this.repo().find({ order: { createdAt: 'ASC' } });
  }

  listPendingInvites(): Promise<TenantInvite[]> {
    return this.invitesRepo().find({ where: { acceptedAt: IsNull() }, order: { invitedAt: 'DESC' } });
  }

  private async requireAdmin(requesterId: string): Promise<User> {
    const requester = await this.repo().findOne({ where: { id: requesterId } });
    if (!requester || requester.globalRole !== GlobalRole.ADMINISTRATOR) {
      throw new ForbiddenException('Only an administrator can do this.');
    }
    return requester;
  }

  /**
   * Real invite: a pending role assignment plus a real email, not just a UI form. Upserts — invite
   * the same still-pending email again and it just updates the role, doesn't error or duplicate,
   * the partial unique index (tenant_id, email WHERE accepted_at IS NULL) is what makes that safe.
   */
  async inviteMember(tenantId: string, requesterId: string, dto: InviteMemberDto): Promise<TenantInvite> {
    const requester = await this.requireAdmin(requesterId);

    const alreadyMember = await this.repo().findOne({ where: { tenantId, email: dto.email } });
    if (alreadyMember) {
      throw new BadRequestException(`${dto.email} is already a member.`);
    }

    let invite = await this.invitesRepo().findOne({ where: { tenantId, email: dto.email, acceptedAt: IsNull() } });
    if (invite) {
      invite.role = dto.role;
      invite.invitedByUserId = requesterId;
      invite.invitedAt = new Date();
    } else {
      invite = this.invitesRepo().create({
        tenantId,
        email: dto.email,
        role: dto.role,
        invitedByUserId: requesterId,
        invitedAt: new Date(),
      });
    }
    invite = await this.invitesRepo().save(invite);

    const tenant = await this.tenantsRepo().findOne({ where: { id: tenantId } });
    const invitedByName = `${requester.firstName} ${requester.lastName}`.trim();
    await this.notifications.sendInvite(dto.email, tenant?.name ?? 'MMM Platform', invitedByName);

    return invite;
  }

  async updateMemberRole(requesterId: string, memberId: string, dto: UpdateMemberRoleDto): Promise<User> {
    await this.requireAdmin(requesterId);
    const member = await this.repo().findOne({ where: { id: memberId } });
    if (!member) {
      throw new NotFoundException(`Member ${memberId} not found.`);
    }
    await this.repo().update(memberId, { globalRole: dto.role });
    return this.repo().findOneOrFail({ where: { id: memberId } });
  }

  async removeMember(requesterId: string, memberId: string): Promise<void> {
    await this.requireAdmin(requesterId);
    if (requesterId === memberId) {
      throw new BadRequestException('You cannot remove yourself.');
    }
    const member = await this.repo().findOne({ where: { id: memberId } });
    if (!member) {
      throw new NotFoundException(`Member ${memberId} not found.`);
    }
    await this.repo().softDelete(memberId);
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    const user = await this.repo().findOneOrFail({ where: { id: userId } });
    return user.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES;
  }

  async updateNotificationPreferences(userId: string, dto: UpdateNotificationPreferencesDto): Promise<NotificationPreferences> {
    const current = await this.getNotificationPreferences(userId);
    const next = { ...current, ...dto };
    await this.repo().update(userId, { notificationPreferences: next });
    return next;
  }

  create(data: {
    tenantId: string;
    email: string;
    firstName: string;
    lastName: string;
    globalRole: GlobalRole;
  }): Promise<User> {
    return this.repo().save(this.repo().create({ ...data, notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES }));
  }
}
