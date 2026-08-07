import { Column, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

export enum GlobalRole {
  MARKETING_ANALYST = 'marketing_analyst',
  MARKETING_MANAGER = 'marketing_manager',
  DATA_SCIENTIST = 'data_scientist',
  ADMINISTRATOR = 'administrator',
}

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

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt: Date | null;
}
