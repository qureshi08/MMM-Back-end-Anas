import { Column, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

/**
 * Replaced the 4 marketing-titled roles with 3 permission tiers, 2026-08-20 — Anas's own real
 * spec: "Master role can delete users and do anything. Read roles: master invites them, they can
 * only read the models. Read/write roles: master invites them, they can read and create models."
 * Master-only: invite/remove members, change roles. Read/write and above: create, edit, train,
 * delete projects and datasets. Read: full visibility, no mutations anywhere.
 */
export enum GlobalRole {
  MASTER = 'master',
  READ = 'read',
  READ_WRITE = 'read_write',
}

export interface NotificationPreferences {
  runCompleted: boolean;
  runFailed: boolean;
  weeklyDigest: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  runCompleted: true,
  runFailed: true,
  weeklyDigest: false,
};

/**
 * Application user. Identity is federated from Microsoft Entra ID — this
 * table never stores a password. Matches Database Schema Design v1.1
 * (Proposed): email is unique per tenant, not globally, so the same person
 * can belong to more than one customer organization.
 */
@Entity('users')
@Index('UQ_users_tenant_email', ['tenantId', 'email'], { unique: true })
export class User extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'text' })
  email: string;

  @Column({ name: 'first_name', type: 'text' })
  firstName: string;

  @Column({ name: 'last_name', type: 'text' })
  lastName: string;

  @Column({ name: 'global_role', type: 'text', enum: GlobalRole })
  globalRole: GlobalRole;

  /** Real, persisted, actually checked before a notification email goes out — see MailNotificationService. */
  @Column({ name: 'notification_preferences', type: 'jsonb' })
  notificationPreferences: NotificationPreferences;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt: Date | null;
}
