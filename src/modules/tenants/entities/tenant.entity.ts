import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DEPROVISIONED = 'deprovisioned',
}

/**
 * One row per customer organization onboarded via Microsoft Marketplace.
 * Matches Database Schema Design v1.1 (Proposed) — see
 * Resources/02-Schema-Review/.
 */
@Entity('tenants')
@Index('UQ_tenants_external_key', ['externalKey'], { unique: true })
export class Tenant extends BaseEntity {
  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', enum: TenantStatus, default: TenantStatus.ACTIVE })
  status: TenantStatus;

  /**
   * How a real login maps to this row. Either `org:<Entra tid>`, one tenant
   * per company, or `personal:<Entra oid>`, since every personal Microsoft
   * account shares the same fixed tid and can't be grouped by it. See
   * TenantResolutionService for where this gets read/written — CMP-42,
   * 2026-08-04. Marketplace-driven tenant creation (CMP-55/77) will need
   * its own key scheme when that's built; this one is for first-login
   * provisioning only.
   */
  @Column({ name: 'external_key', type: 'text' })
  externalKey: string;
}
