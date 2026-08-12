import { Column, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Project } from '../../projects/entities/project.entity';

/**
 * Corrected twice in one day. First pass: `project-context.md` said
 * Meridian vs PyMC-Marketing was undecided, so this started as a
 * user-facing picklist between the two. Second pass, after Hammad's real
 * handover confirmed there's only one real engine today, this briefly
 * became a fixed, non-caller-supplied value. Final, confirmed answer
 * (2026-08-11): keep it a real, caller-supplied dropdown, same structure
 * and flow as Cassandra's own model-type picker, deliberately built to
 * scale to more models later. Today it only has one real value, that's a
 * fact about the roadmap, not a reason to remove the choice from the API.
 */
export enum ModelType {
  MERIDIAN = 'meridian',
}

export enum DatasetStatus {
  UPLOADED = 'uploaded',
  VALIDATED = 'validated',
  FAILED = 'failed',
}

export enum KpiType {
  REVENUE = 'revenue',
  NON_REVENUE = 'non_revenue',
}

/**
 * What the Configure screen actually collects, matching Hammad's `column_mapping` field for field.
 * `geoColumns` added 2026-08-12: present in Hammad's real API Contracts document, with his own note
 * that it "is not yet present in the current database schema, this needs to be added there." It now is.
 */
export interface ColumnMapping {
  dateColumn: string;
  targetColumn: string;
  mediaColumns: string[];
  controlColumns: string[];
  organicColumns: string[];
  geoColumns: string[];
}

/** What the Optimize screen collects: the date range the training run actually uses. */
export interface DateRange {
  startDate: string;
  endDate: string;
}

/** What the Calibrate screen collects, matching `model_configuration.calibration`. */
export interface Calibration {
  contributionBeliefPercent: number;
  confidencePercent: number;
}

/** One row per channel from the Hyperparameterization screen, matching `model_configuration.channels`. */
export interface ChannelHyperparameter {
  channel: string;
  carryover: number;
  saturation: number;
}

/**
 * `StorageProvider` exists so a dataset's row always says which backend its
 * file actually lives in, not just which one is configured today. Dev runs
 * on Cloudflare R2 (2026-08-11 decision, storage abstracted behind
 * `StorageService`); the real Azure Marketplace target is Azure Blob
 * Storage. A row written under one provider stays correctly labeled even
 * after the app's default provider changes.
 */
export enum StorageProvider {
  CLOUDFLARE_R2 = 'cloudflare_r2',
  AZURE_BLOB = 'azure_blob',
}

/**
 * Belongs to a project (CMP-38). Postgres never holds the file itself, only
 * the pointer (`storageKey`) into whichever `StorageProvider` actually
 * stored it — same pointer-only pattern documented for Blob Storage in
 * `ARCHITECTURE.html` Section 06.
 */
@Entity('datasets')
@Index('IDX_datasets_tenant_id', ['tenantId'])
@Index('IDX_datasets_project_id', ['projectId'])
export class Dataset extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'model_type', type: 'text', enum: ModelType })
  modelType: ModelType;

  @Column({ name: 'storage_provider', type: 'text', enum: StorageProvider, default: StorageProvider.CLOUDFLARE_R2 })
  storageProvider: StorageProvider;

  @Column({ name: 'storage_key', type: 'text' })
  storageKey: string;

  @Column({ name: 'file_name', type: 'text' })
  fileName: string;

  @Column({ name: 'file_size_bytes', type: 'bigint' })
  fileSizeBytes: number;

  @Column({ name: 'mime_type', type: 'text' })
  mimeType: string;

  @Column({ type: 'text', enum: DatasetStatus, default: DatasetStatus.UPLOADED })
  status: DatasetStatus;

  @Column({ name: 'column_mapping', type: 'jsonb', nullable: true })
  columnMapping: ColumnMapping | null;

  @Column({ name: 'kpi_type', type: 'text', enum: KpiType, nullable: true })
  kpiType: KpiType | null;

  /**
   * Hammad's contract: "required only if kpi_type is non_revenue; otherwise null." Real dollar
   * value of one unit of the KPI (subscriptions, signups, ...), needed to convert a non-revenue
   * outcome into a real dollar figure the model can optimize against.
   */
  @Column({ name: 'revenue_per_kpi_value', type: 'numeric', nullable: true })
  revenuePerKpiValue: number | null;

  @Column({ name: 'date_range', type: 'jsonb', nullable: true })
  dateRange: DateRange | null;

  @Column({ type: 'jsonb', nullable: true })
  calibration: Calibration | null;

  @Column({ name: 'channel_hyperparameters', type: 'jsonb', nullable: true })
  channelHyperparameters: ChannelHyperparameter[] | null;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt: Date | null;
}
