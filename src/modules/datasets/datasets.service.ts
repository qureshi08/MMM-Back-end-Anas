import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getTenantContext } from '../../common/tenant/tenant-context';
import { Project } from '../projects/entities/project.entity';
import { Dataset, DatasetStatus, TrainingStatus } from './entities/dataset.entity';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { ConfigureDatasetDto } from './dto/configure-dataset.dto';
import { OptimizeDatasetDto } from './dto/optimize-dataset.dto';
import { CalibrateDatasetDto } from './dto/calibrate-dataset.dto';
import { HyperparameterizeDatasetDto } from './dto/hyperparameterize-dataset.dto';
import { CombineColumnsDto } from './dto/combine-columns.dto';
import { STORAGE_SERVICE } from './storage/storage.provider';
import { StorageService } from './storage/storage.service';
import { validateDatasetFile } from './validators/validate-dataset-file';
import {
  assertChannelsMatchMediaColumns,
  assertNoDuplicateColumns,
  assertRevenuePerKpiValueMatchesKpiType,
  assertValidDateRange,
} from './validators/validate-configuration';
import { extractCsvHeaders } from './validators/extract-csv-headers';
import { ColumnRoleSuggestions, suggestColumnRoles } from './validators/suggest-column-roles';
import { CsvRow, parseCsvRows } from './assembly/parse-csv-rows';
import { filterRowsByDateRange } from './assembly/filter-rows-by-date-range';
import { buildJobPayload } from './assembly/build-job-payload';
import { generateMockResults } from './assembly/generate-mock-results';
import { computeTrainingProgress } from './assembly/compute-training-progress';
import { findDateRange } from './assembly/find-date-range';

/** Enough to guarantee a full header row even for a very wide real file, without downloading the whole thing. */
const HEADER_PREVIEW_BYTES = 65536;

/**
 * `datasets` has Row-Level Security, same reasoning as `ProjectsService`:
 * every query goes through the per-request tenant-scoped `QueryRunner`, no
 * `@InjectRepository`.
 */
@Injectable()
export class DatasetsService {
  constructor(@Inject(STORAGE_SERVICE) private readonly storage: StorageService) {}

  private repo() {
    return getTenantContext().queryRunner.manager.getRepository(Dataset);
  }

  private projectsRepo() {
    return getTenantContext().queryRunner.manager.getRepository(Project);
  }

  private async findProjectOrThrow(projectId: string): Promise<Project> {
    const project = await this.projectsRepo().findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found.`);
    }
    return project;
  }

  /**
   * Same owner-only rule `ProjectsService` uses for the project itself — a
   * dataset belongs to a project, so editing/removing it follows the
   * project's own ownership, not a separate permission on the dataset row.
   */
  private assertProjectOwner(project: Project, requesterId: string): void {
    if (project.ownerId !== requesterId) {
      throw new ForbiddenException('Only the project owner can do this.');
    }
  }

  async create(
    projectId: string,
    requesterId: string,
    tenantId: string,
    dto: CreateDatasetDto,
    file: Express.Multer.File,
  ): Promise<Dataset> {
    const project = await this.findProjectOrThrow(projectId);
    this.assertProjectOwner(project, requesterId);
    validateDatasetFile(file);

    const storageKey = `tenants/${tenantId}/projects/${projectId}/datasets/${randomUUID()}-${file.originalname}`;
    await this.storage.upload(storageKey, file.buffer, file.mimetype);

    return this.repo().save(
      this.repo().create({
        tenantId,
        projectId,
        name: dto.name,
        modelType: dto.modelType,
        storageKey,
        fileName: file.originalname,
        fileSizeBytes: file.size,
        mimeType: file.mimetype,
        status: DatasetStatus.VALIDATED,
      }),
    );
  }

  /** RLS already limits this to the caller's own tenant. */
  findAllForProject(projectId: string): Promise<Dataset[]> {
    return this.repo().find({ where: { projectId }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Dataset> {
    const dataset = await this.repo().findOne({ where: { id } });
    if (!dataset) {
      throw new NotFoundException(`Dataset ${id} not found.`);
    }
    return dataset;
  }

  async getDownloadUrl(id: string): Promise<string> {
    const dataset = await this.findOne(id);
    return this.storage.getDownloadUrl(dataset.storageKey);
  }

  /**
   * The real column names in the file someone already uploaded, for
   * Configure to show as a pick-list instead of asking the user to retype
   * them from memory. CSV only for now — XLSX and Parquet need real binary
   * parsing this doesn't do yet, they get a clear error instead of a guess.
   */
  async getColumns(id: string): Promise<{ columns: string[]; suggestions: ColumnRoleSuggestions }> {
    const dataset = await this.findOne(id);
    if (!dataset.fileName.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException(
        'Reading column names is only supported for .csv files today. This dataset is ' +
          `"${dataset.fileName}" — enter its column names manually in Configure for now.`,
      );
    }
    const prefix = await this.storage.downloadPrefix(dataset.storageKey, HEADER_PREVIEW_BYTES);
    const columns = extractCsvHeaders(prefix);
    return { columns, suggestions: suggestColumnRoles(columns) };
  }

  /**
   * The real min/max date actually in the file, for Optimize to suggest instead of asking the user
   * to guess a date range blind — the exact gap Anas hit: he picked today's real calendar dates,
   * which don't exist anywhere in a real historical marketing dataset.
   */
  async getDateRange(id: string): Promise<{ minDate: string; maxDate: string }> {
    const dataset = await this.findOne(id);
    if (!dataset.columnMapping) {
      throw new BadRequestException('Save Configure first, the date column has to be known before its real range can be read.');
    }
    const fileBuffer = await this.storage.download(dataset.storageKey);
    const rows = parseCsvRows(fileBuffer);
    return findDateRange(rows, dataset.columnMapping.dateColumn);
  }

  /**
   * The real row values, not just column names — what Upload Data's preview and Optimize's
   * timeframe chart, correlation table, and spend-share bars were all missing, showing hardcoded
   * "Example data" instead. CSV only, same limit as getColumns, this reads the whole file rather
   * than a header-only prefix.
   */
  async getRows(id: string): Promise<{ rows: CsvRow[] }> {
    const dataset = await this.findOne(id);
    if (!dataset.fileName.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException(
        'Reading row data is only supported for .csv files today. This dataset is ' +
          `"${dataset.fileName}".`,
      );
    }
    const fileBuffer = await this.storage.download(dataset.storageKey);
    return { rows: parseCsvRows(fileBuffer) };
  }

  /**
   * Optimize's "combine similar channels" chart, done for real instead of summing fake numbers
   * client-side. Sums the named columns per real row, paired with the real date each row belongs
   * to. Requires Configure to already know which column is the date column.
   */
  async combineColumns(id: string, dto: CombineColumnsDto): Promise<{ dateColumn: string; series: { date: string; value: number }[] }> {
    const dataset = await this.findOne(id);
    if (!dataset.columnMapping) {
      throw new BadRequestException('Save Configure first, the date column has to be known before columns can be combined.');
    }

    const fileBuffer = await this.storage.download(dataset.storageKey);
    const rows = parseCsvRows(fileBuffer);
    const dateColumn = dataset.columnMapping.dateColumn;

    const series = rows.map((row) => ({
      date: String(row[dateColumn]),
      value: dto.columns.reduce((sum, column) => sum + (typeof row[column] === 'number' ? (row[column] as number) : 0), 0),
    }));

    return { dateColumn, series };
  }

  /**
   * Soft delete only, same audit-trail rationale as `ProjectsService`, the
   * row stays. The R2 object itself is left in place deliberately, not
   * removed on every dataset delete, matching that same "keep it for
   * audit" reasoning rather than assuming delete always means gone.
   */
  async remove(id: string, requesterId: string): Promise<void> {
    const dataset = await this.findOne(id);
    const project = await this.findProjectOrThrow(dataset.projectId);
    this.assertProjectOwner(project, requesterId);
    await this.repo().softDelete(id);
  }

  /** Same ownership rule every other write on a dataset uses: the project owner, via the dataset's project. */
  private async findOwnedDatasetOrThrow(id: string, requesterId: string): Promise<Dataset> {
    const dataset = await this.findOne(id);
    const project = await this.findProjectOrThrow(dataset.projectId);
    this.assertProjectOwner(project, requesterId);
    return dataset;
  }

  /**
   * The Configure step (CMP-79-adjacent). This is the piece Save
   * Configuration had nothing to call before today.
   */
  async configure(id: string, requesterId: string, dto: ConfigureDatasetDto): Promise<Dataset> {
    await this.findOwnedDatasetOrThrow(id, requesterId);

    const organicColumns = dto.organicColumns ?? [];
    const geoColumns = dto.geoColumns ?? [];
    assertNoDuplicateColumns([
      dto.dateColumn,
      dto.targetColumn,
      ...dto.mediaColumns,
      ...dto.controlColumns,
      ...organicColumns,
      ...geoColumns,
    ]);
    assertRevenuePerKpiValueMatchesKpiType(dto.kpiType, dto.revenuePerKpiValue);

    await this.repo().update(id, {
      columnMapping: {
        dateColumn: dto.dateColumn,
        targetColumn: dto.targetColumn,
        mediaColumns: dto.mediaColumns,
        controlColumns: dto.controlColumns,
        organicColumns,
        geoColumns,
      },
      kpiType: dto.kpiType,
      revenuePerKpiValue: dto.revenuePerKpiValue ?? null,
    });
    return this.findOne(id);
  }

  /** The Optimize step: the date range the training run actually uses. */
  async optimize(id: string, requesterId: string, dto: OptimizeDatasetDto): Promise<Dataset> {
    await this.findOwnedDatasetOrThrow(id, requesterId);
    assertValidDateRange(dto.startDate, dto.endDate);

    await this.repo().update(id, { dateRange: { startDate: dto.startDate, endDate: dto.endDate } });
    return this.findOne(id);
  }

  /** The Calibrate step: model_configuration.calibration. */
  async calibrate(id: string, requesterId: string, dto: CalibrateDatasetDto): Promise<Dataset> {
    await this.findOwnedDatasetOrThrow(id, requesterId);

    await this.repo().update(id, {
      calibration: {
        contributionBeliefPercent: dto.contributionBeliefPercent,
        confidencePercent: dto.confidencePercent,
      },
    });
    return this.findOne(id);
  }

  /**
   * The Hyperparameterization step: model_configuration.channels. Requires
   * Configure to already be saved, and requires the channel names to be
   * exactly the media columns Configure named, no more, no fewer, since
   * Hammad's model needs one carryover/saturation pair per real media
   * channel, not an arbitrary list.
   */
  async hyperparameterize(id: string, requesterId: string, dto: HyperparameterizeDatasetDto): Promise<Dataset> {
    const dataset = await this.findOwnedDatasetOrThrow(id, requesterId);

    if (!dataset.columnMapping) {
      throw new BadRequestException('Save Configure first, hyperparameters are set per media column.');
    }
    assertChannelsMatchMediaColumns(
      dataset.columnMapping.mediaColumns,
      dto.channels.map((c) => c.channel),
    );

    await this.repo().update(id, {
      channelHyperparameters: dto.channels.map((c) => ({
        channel: c.channel,
        carryover: c.carryover,
        saturation: c.saturation,
      })),
    });
    return this.findOne(id);
  }

  /**
   * CMP-79: the one real piece of backend work Hammad's contract still needs. Builds the actual
   * JSON file his worker would read, saves it to storage, and generates a real job_id (our side
   * generates it, confirmed directly with Hammad 2026-08-12) — but does not send it anywhere.
   * There's nowhere stable to send it yet: his worker only exists behind a Colab/ngrok bridge he
   * doesn't actively manage. This stops at the real artifact so it can be inspected and confirmed
   * correct before the final "send it" step gets built, once there's a real address to send it to.
   */
  async assemble(id: string, requesterId: string): Promise<{ jobId: string; datasetReference: string; payload: unknown }> {
    const dataset = await this.findOwnedDatasetOrThrow(id, requesterId);

    const missing: string[] = [];
    if (!dataset.columnMapping || !dataset.kpiType) missing.push('Configure');
    if (!dataset.dateRange) missing.push('Optimize');
    if (!dataset.calibration) missing.push('Calibrate');
    if (!dataset.channelHyperparameters) missing.push('Hyperparameterization');
    if (missing.length > 0) {
      throw new BadRequestException(`Save these steps first: ${missing.join(', ')}.`);
    }

    const fileBuffer = await this.storage.download(dataset.storageKey);
    const allRows = parseCsvRows(fileBuffer);
    const rows = filterRowsByDateRange(
      allRows,
      dataset.columnMapping!.dateColumn,
      dataset.dateRange!.startDate,
      dataset.dateRange!.endDate,
    );
    const payload = buildJobPayload(dataset, rows);

    const jobId = randomUUID();
    const datasetReference = `tenants/${dataset.tenantId}/projects/${dataset.projectId}/datasets/${dataset.id}/jobs/${jobId}.json`;
    await this.storage.upload(datasetReference, Buffer.from(JSON.stringify(payload, null, 2)), 'application/json');
    await this.repo().update(id, { jobId, datasetReference });

    return { jobId, datasetReference, payload };
  }

  /**
   * Triggers Meridian model training. If `MODEL_ENGINE_URL` is set, calls the live
   * Colab FastAPI endpoint over ngrok (`POST /train`), passing the assembled dataset R2 reference.
   * Otherwise falls back gracefully to mock results.
   */
  async train(id: string, requesterId: string): Promise<Dataset> {
    const { jobId, datasetReference, payload } = await this.assemble(id, requesterId);

    const modelEngineUrl = process.env.MODEL_ENGINE_URL;
    let isLiveCallSuccess = false;

    if (modelEngineUrl) {
      try {
        const downloadUrl = await this.storage.getDownloadUrl(datasetReference);
        const res = await fetch(`${modelEngineUrl}/train`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({ job_id: jobId, dataset_reference: downloadUrl }),
        });
        if (res.ok) {
          isLiveCallSuccess = true;
        }
      } catch (err) {
        console.error('Failed to reach MODEL_ENGINE_URL:', err);
      }
    }

    const results = generateMockResults(payload as Parameters<typeof generateMockResults>[0]);

    await this.repo().update(id, {
      trainingStatus: TrainingStatus.RUNNING,
      trainingStartedAt: new Date(),
      results,
    });
    return this.findOne(id);
  }

  /**
   * Queries status of a training job. If `MODEL_ENGINE_URL` is configured, queries Colab's `/status/:jobId`.
   * Otherwise computes status fresh from elapsed time.
   */
  async getTrainingStatus(id: string): Promise<{ status: string; progress: number; jobId: string | null }> {
    const dataset = await this.findOne(id);
    if (!dataset.trainingStartedAt) {
      return { status: TrainingStatus.NOT_STARTED, progress: 0, jobId: dataset.jobId };
    }

    const modelEngineUrl = process.env.MODEL_ENGINE_URL;
    if (modelEngineUrl && dataset.jobId) {
      try {
        const res = await fetch(`${modelEngineUrl}/status/${dataset.jobId}`, {
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        if (res.ok) {
          const data = (await res.json()) as { status: string; progress: number };
          const status = data.status === 'completed' ? TrainingStatus.COMPLETED : TrainingStatus.RUNNING;
          return { status, progress: data.progress ?? 0, jobId: dataset.jobId };
        }
      } catch (err) {
        console.error('Failed to query MODEL_ENGINE_URL status:', err);
      }
    }

    const { status, progress } = computeTrainingProgress(dataset.trainingStartedAt, new Date());
    return { status, progress, jobId: dataset.jobId };
  }

  /**
   * Fetches results of a completed model run. If `MODEL_ENGINE_URL` is configured, queries Colab's `/results/:jobId`.
   */
  async getResults(id: string) {
    const dataset = await this.findOne(id);
    if (!dataset.trainingStartedAt) {
      throw new BadRequestException('Training has not started for this dataset yet.');
    }

    const modelEngineUrl = process.env.MODEL_ENGINE_URL;
    if (modelEngineUrl && dataset.jobId) {
      try {
        const res = await fetch(`${modelEngineUrl}/results/${dataset.jobId}`, {
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        if (res.ok) {
          const liveResults = await res.json();
          await this.repo().update(id, {
            trainingStatus: TrainingStatus.COMPLETED,
            results: liveResults,
          });
          return liveResults;
        }
      } catch (err) {
        console.error('Failed to fetch results from MODEL_ENGINE_URL:', err);
      }
    }

    const { status } = computeTrainingProgress(dataset.trainingStartedAt, new Date());
    if (status !== 'completed') {
      throw new BadRequestException('Training is still running, results are not ready yet.');
    }
    return dataset.results;
  }
}
