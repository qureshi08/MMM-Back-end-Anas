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
 * A real, persisted "combine similar channels" decision, applied when Assembly builds the job
 * file — not just the Optimize preview chart. Real gap found 2026-08-18: the chart-only version
 * (`POST /datasets/:id/combine-columns`) never touched `columnMapping.mediaColumns`, so a "combined"
 * channel still reached Meridian as two separate, highly collinear raw columns and correctly got
 * rejected (extreme VIF). This is the fix — `sourceColumns` get summed into `newColumnName` on every
 * real row before the job file is built, and removed from `mediaColumns`.
 */
export interface ChannelCombination {
  sourceColumns: string[];
  newColumnName: string;
}

/**
 * 2026-08-12: real training against Hammad's worker is on hold, blocked on decisions still with
 * Farhan (see `dev-log/raw/2026-08-11.md`). Decided with Anas: build a mock training run instead,
 * using this exact real shape — copied field for field from Hammad's own real sample output,
 * `Resources/Handover MMM - Hammad/Model Integration Original/final_results.json` — so that
 * swapping the mock for a real trained result later is a data-source change, not a rebuild.
 */
export enum TrainingStatus {
  NOT_STARTED = 'not_started',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface TrainingResults {
  data_used: {
    date_column: string;
    target_column: string;
    media_columns: string[];
    control_columns: string[];
    organic_columns: string[];
    geo_columns: string[];
    first_date: string;
    last_date: string;
    row_count: number;
  };
  model_confidence: {
    overall_accuracy_percent: number;
    overall_accuracy_formula: string;
    average_error_percent: number;
    weighted_average_error_percent: number;
    r_squared: number;
    adjusted_r_squared: number;
  };
  channel_contribution: Array<{
    channel: string;
    spend: number;
    pct_of_spend: number;
    incremental_outcome: number;
    pct_of_contribution: number;
  }>;
  channel_efficiency: Array<{
    channel: string;
    roi: number;
    marginal_roi: number;
    effectiveness: number;
    cost_per_incremental_result: number;
  }>;
  data_quality_flags: Array<{ message: string; columns_involved: string[] }>;
  budget_recommendation: Array<{
    channel: string;
    current_spend: number;
    current_pct_of_budget: number;
    optimized_spend: number;
    optimized_pct_of_budget: number;
    spend_change_dollars: number;
    spend_change_percent: number;
    current_roi: number;
    optimized_roi: number;
  }>;
  saturation_status: Array<{ channel: string; carryover_label: string; saturation_label: string }>;
  adstock_decay_curves: Array<{
    channel: string;
    curve: Array<{ weeks_since_spend: number; effect_remaining_percent: number }>;
  }>;
  saturation_curves: Array<{
    channel: string;
    curve: Array<{ spend_level: number; effect: number }>;
    historical_spend_distribution: Array<{
      spend_range_start: number;
      spend_range_end: number;
      relative_frequency_percent: number;
    }>;
  }>;
  status: 'completed';
  mock: true;

  /**
   * Three real fields the current contract doesn't have yet, flagged 2026-08-22 (Amna's Claude,
   * relaying Hammad: "we can build a very good story around the results, right now nothing is
   * happening"). All three are things a Bayesian model like Meridian plausibly already computes
   * internally as part of its own methodology (a posterior gives a confidence range for free;
   * separating baseline from marketing-driven outcome is the whole point of MMM) — not new
   * modeling work, most likely just missing from what his engine currently writes into
   * `results.json`. Optional here so the real contract can gain them with zero backend change the
   * moment his engine does — populated in the mock generator now so the frontend "story" can be
   * built and tested today, before his engine ships them for real.
   */
  actual_vs_predicted?: Array<{ date: string; actual: number; predicted: number }>;
  channel_confidence?: Array<{
    channel: string;
    roi_low: number;
    roi_high: number;
    confidence_percent: number;
  }>;
  baseline_vs_marketing?: {
    baseline_outcome: number;
    marketing_outcome: number;
    baseline_percent: number;
    marketing_percent: number;
  };
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

  /**
   * Real "model owner" for display, 2026-08-20 — the person who actually uploaded this dataset,
   * not the project's owner (a project commonly has more than one person uploading into it).
   * Nullable only because existing rows predate this column; every new upload sets it.
   */
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

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

  @Column({ name: 'channel_combinations', type: 'jsonb', nullable: true })
  channelCombinations: ChannelCombination[] | null;

  /** Set by POST /datasets/:id/assemble. The real job_id and pointer, kept even though nothing is sent anywhere yet. */
  @Column({ name: 'job_id', type: 'text', nullable: true })
  jobId: string | null;

  @Column({ name: 'dataset_reference', type: 'text', nullable: true })
  datasetReference: string | null;

  @Column({ name: 'training_status', type: 'text', enum: TrainingStatus, default: TrainingStatus.NOT_STARTED })
  trainingStatus: TrainingStatus;

  /** When POST /datasets/:id/train was called. GET /status computes a fake "running" window from this, purely for a real-feeling UI, no background job involved. */
  @Column({ name: 'training_started_at', type: 'timestamptz', nullable: true })
  trainingStartedAt: Date | null;

  /** Real shape, mock content, see TrainingResults' own comment. */
  @Column({ type: 'jsonb', nullable: true })
  results: TrainingResults | null;

  /** Whoever actually clicked Train Model — the real person a completion/failure email goes to. */
  @Column({ name: 'trained_by_user_id', type: 'uuid', nullable: true })
  trainedByUserId: string | null;

  /**
   * Null until a real completion/failure email has actually been sent for the current run — the
   * guard against sending it again on every status poll. Reset to null every time `train()` starts
   * a new run, so the next real terminal state gets its own real notification.
   */
  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt: Date | null;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt: Date | null;
}
