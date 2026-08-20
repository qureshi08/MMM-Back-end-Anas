import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Tenant } from './tenant.entity';
import { GlobalRole, User } from '../../users/entities/user.entity';

/**
 * A real, pending role assignment for an email that hasn't signed in yet.
 * TenantResolutionService checks this at first login and applies the
 * invited role instead of defaulting everyone to Administrator — see that
 * service's own comment for the "provisional, revisit before GA" gap this
 * closes, 2026-08-19.
 */
@Entity('tenant_invites')
export class TenantInvite extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'text' })
  email: string;

  @Column({ type: 'text', enum: GlobalRole })
  role: GlobalRole;

  @Column({ name: 'invited_by_user_id', type: 'uuid' })
  invitedByUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invited_by_user_id' })
  invitedBy: User;

  @Column({ name: 'invited_at', type: 'timestamptz' })
  invitedAt: Date;

  /** Null while pending. Set the moment someone with this email actually signs in. */
  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;
}
