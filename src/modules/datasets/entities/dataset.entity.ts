import { Column, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Project } from '../../projects/entities/project.entity';

/**
 * Corrected 2026-08-11, same day it was written: `project-context.md` said
 * Meridian vs PyMC-Marketing was still undecided, so this started as a
 * user-facing picklist between the two. Hammad's real handover
 * (`dev-log/for-anas/modeling-engine-explained.html` Section 04) shows
 * that's stale — there's only one real engine, Meridian, already built and
 * proven. Kept as a single-value enum, not removed outright, so a row still
 * says which engine trained it if a second one is ever added for real; a
 * dataset is never created with anything else, see `DatasetsService`.
 */
export enum ModelType {
  MERIDIAN = 'meridian',
}

export enum DatasetStatus {
  UPLOADED = 'uploaded',
  VALIDATED = 'validated',
  FAILED = 'failed',
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

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt: Date | null;
}
