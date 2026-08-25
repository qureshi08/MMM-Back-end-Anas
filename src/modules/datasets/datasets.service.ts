import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getTenantContext } from '../../common/tenant/tenant-context';
import { ChannelCombination, Dataset, DatasetStatus, TrainingStatus } from './entities/dataset.entity';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { ConfigureDatasetDto } from './dto/configure-dataset.dto';
import { OptimizeDatasetDto } from './dto/optimize-dataset.dto';
import { CalibrateDatasetDto } from './dto/calibrate-dataset.dto';
import { HyperparameterizeDatasetDto } from './dto/hyperparameterize-dataset.dto';
import { CombineColumnsDto } from './dto/combine-columns.dto';
import { CombineChannelsDto } from './dto/combine-channels.dto';
import { applyChannelCombinations } from './assembly/apply-channel-combinations';
import { nameForGroup, suggestChannelGroups } from './assembly/suggest-channel-combinations';
import { STORAGE_SERVICE } from './storage/storage.provider';
import { NotificationService } from '../../common/mail/notification.service';
import { UsersService } from '../users/users.service';
import { ProjectsService } from '../projects/projects.service';
import { GlobalRole } from '../users/entities/user.entity';
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
import { findDateRange } from './assembly/find-date-range';

/** Enough to guarantee a full header row even for a very wide real file, without downloading the whole thing. */
const HEADER_PREVIEW_BYTES = 65536;

/**
 * Headers sent on every call to the real model engine (Colab, over ngrok). `ngrok-skip-browser-warning`
 * skips ngrok's one-time interstitial page for non-browser callers. `X-Internal-Secret` only gets sent
 * if `MODEL_ENGINE_SECRET` is actually set — without it, anyone who obtains the ngrok URL could call
 * /train, /status, /results directly, this is the one thing standing in the way of that.
 */
function modelEngineHeaders(extra?: Record<string, string>): Record<string, string> {
  const secret = process.env.MODEL_ENGINE_SECRET;
  return {
    'ngrok-skip-browser-warning': 'true',
    ...(secret ? { 'X-Internal-Secret': secret } : {}),
    ...extra,
  };
}

/**
 * `datasets` has Row-Level Security, same reasoning as `ProjectsService`:
 * every query goes through the per-request tenant-scoped `QueryRunner`, no
 * `@InjectRepository`.
 */
@Injectable()
export class DatasetsService {
  constructor(
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly notifications: NotificationService,
    private readonly users: UsersService,
    private readonly projects: ProjectsService,
  ) {}

  /**
   * Sends the real completion/failure email exactly once per run, to whoever actually clicked
   * Train Model — guarded by `notifiedAt`, reset to null every time `train()` starts a new run.
   * Called from both `getTrainingStatus` (failure) and `getResults` (completion), the two real
   * places a terminal state is first observed.
   */
  private async notifyIfNeeded(id: string, status: TrainingStatus, errorMessage?: string | null): Promise<void> {
    if (status !== TrainingStatus.COMPLETED && status !== TrainingStatus.FAILED) return;

    // Raw fetch, not the access-checked findOne — this runs as a system side effect of a status
    // poll, not on behalf of any particular requester with a role to check.
    const dataset = await this.findEntity(id);
    if (dataset.notifiedAt || !dataset.trainedByUserId) return;

    await this.repo().update(id, { notifiedAt: new Date() });

    const trainedBy = await this.users.findById(dataset.trainedByUserId);
    if (!trainedBy) return;

    if (status === TrainingStatus.COMPLETED && trainedBy.notificationPreferences?.runCompleted) {
      await this.notifications.sendRunCompleted(trainedBy.email, dataset.id, dataset.name);
    } else if (status === TrainingStatus.FAILED && trainedBy.notificationPreferences?.runFailed) {
      await this.notifications.sendRunFailed(trainedBy.email, dataset.id, dataset.name, errorMessage ?? null);
    }
  }

  private repo() {
    return getTenantContext().queryRunner.manager.getRepository(Dataset);
  }

  /** Raw fetch, no access check — for internal use (notifyIfNeeded) and as the base for findOne. */
  private async findEntity(id: string): Promise<Dataset> {
    const dataset = await this.repo().findOne({ where: { id } });
    if (!dataset) {
      throw new NotFoundException(`Dataset ${id} not found.`);
    }
    return dataset;
  }

  /**
   * Real access check, 2026-08-20: a dataset's privacy is only as real as its parent project's —
   * delegates to `ProjectsService.assertAccess`, same Master/owner/project_members rule, so a
   * private project's datasets can't be reached by guessing a dataset ID directly.
   */
  async findOne(id: string, requesterId: string, globalRole: GlobalRole): Promise<Dataset> {
    const dataset = await this.findEntity(id);
    await this.projects.assertAccessById(dataset.projectId, requesterId, globalRole);
    return dataset;
  }

  async create(
    projectId: string,
    requesterId: string,
    tenantId: string,
    globalRole: GlobalRole,
    dto: CreateDatasetDto,
    file: Express.Multer.File,
  ): Promise<Dataset> {
    // Throws if the requester can't see this project at all — same Master/owner/project_members
    // check every other dataset access goes through.
    await this.projects.findOne(projectId, requesterId, globalRole);
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
        createdByUserId: requesterId,
      }),
    );
  }

  async findAllForProject(projectId: string, requesterId: string, globalRole: GlobalRole): Promise<Dataset[]> {
    await this.projects.assertAccessById(projectId, requesterId, globalRole);
    return this.repo().find({ where: { projectId }, order: { createdAt: 'DESC' } });
  }

  async getDownloadUrl(id: string, requesterId: string, globalRole: GlobalRole): Promise<string> {
    const dataset = await this.findOne(id, requesterId, globalRole);
    return this.storage.getDownloadUrl(dataset.storageKey);
  }

  /**
   * The real column names in the file someone already uploaded, for
   * Configure to show as a pick-list instead of asking the user to retype
   * them from memory. CSV only for now — XLSX and Parquet need real binary
   * parsing this doesn't do yet, they get a clear error instead of a guess.
   */
  async getColumns(
    id: string,
    requesterId: string,
    globalRole: GlobalRole,
  ): Promise<{ columns: string[]; suggestions: ColumnRoleSuggestions }> {
    const dataset = await this.findOne(id, requesterId, globalRole);
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
  async getDateRange(id: string, requesterId: string, globalRole: GlobalRole): Promise<{ minDate: string; maxDate: string }> {
    const dataset = await this.findOne(id, requesterId, globalRole);
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
  async getRows(id: string, requesterId: string, globalRole: GlobalRole): Promise<{ rows: CsvRow[] }> {
    const dataset = await this.findOne(id, requesterId, globalRole);
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
  async combineColumns(
    id: string,
    requesterId: string,
    globalRole: GlobalRole,
    dto: CombineColumnsDto,
  ): Promise<{ dateColumn: string; series: { date: string; value: number }[] }> {
    const dataset = await this.findOne(id, requesterId, globalRole);
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
   * The real "combine similar channels" decision — unlike `combineColumns` above (chart preview
   * only), this actually changes what training sees: removes the source columns from
   * `columnMapping.mediaColumns`, replaces them with the new combined name, and saves the
   * combination so `assemble()` can sum it into every real row later. Clears
   * `channelHyperparameters`, since it no longer matches the new media column list — Hammad's
   * contract needs one carryover/saturation pair per real channel, that has to be redone.
   */
  async combineChannels(id: string, requesterId: string, globalRole: GlobalRole, dto: CombineChannelsDto): Promise<Dataset> {
    const dataset = await this.findOne(id, requesterId, globalRole);
    if (!dataset.columnMapping) {
      throw new BadRequestException('Save Configure first, channels can only be combined once media columns are known.');
    }

    const mediaColumns = dataset.columnMapping.mediaColumns;
    const missing = dto.sourceColumns.filter((c) => !mediaColumns.includes(c));
    if (missing.length > 0) {
      throw new BadRequestException(`Not real media columns on this dataset: ${missing.join(', ')}.`);
    }
    if (mediaColumns.includes(dto.newColumnName) && !dto.sourceColumns.includes(dto.newColumnName)) {
      throw new BadRequestException(`"${dto.newColumnName}" already names a different real media column.`);
    }

    const newMediaColumns = [...mediaColumns.filter((c) => !dto.sourceColumns.includes(c)), dto.newColumnName];
    const combination: ChannelCombination = { sourceColumns: dto.sourceColumns, newColumnName: dto.newColumnName };

    await this.repo().update(id, {
      columnMapping: { ...dataset.columnMapping, mediaColumns: newMediaColumns },
      channelCombinations: [...(dataset.channelCombinations ?? []), combination],
      channelHyperparameters: null,
    });
    return this.findOne(id, requesterId, globalRole);
  }

  /**
   * "Combine what's flagged" — the one-click version. Finds every real group of media columns
   * whose pairwise correlation is 90% or higher (the same real math the Optimize correlation table
   * already shows, chained so A-B-C group together if A-B and B-C both qualify, not just isolated
   * pairs), and applies a real combination to each group in one call, the same way `combineChannels`
   * does. Doesn't guess at exact Meridian VIF thresholds, that check only exists inside his engine —
   * this is the closest real, self-contained approximation, and would have caught the real
   * `paid_social_spend` rejection found 2026-08-18 before Train Model ever ran.
   */
  async autoCombineChannels(
    id: string,
    requesterId: string,
    globalRole: GlobalRole,
  ): Promise<{ dataset: Dataset; combined: ChannelCombination[] }> {
    const dataset = await this.findOne(id, requesterId, globalRole);
    if (!dataset.columnMapping) {
      throw new BadRequestException('Save Configure first, channels can only be combined once media columns are known.');
    }

    const fileBuffer = await this.storage.download(dataset.storageKey);
    const rows = parseCsvRows(fileBuffer);
    const groups = suggestChannelGroups(rows, dataset.columnMapping.mediaColumns);

    if (groups.length === 0) {
      return { dataset, combined: [] };
    }

    const combinedSourceColumns = new Set(groups.flat());
    const newMediaColumns = [
      ...dataset.columnMapping.mediaColumns.filter((c) => !combinedSourceColumns.has(c)),
      ...groups.map(nameForGroup),
    ];
    const newCombinations: ChannelCombination[] = groups.map((group) => ({
      sourceColumns: group,
      newColumnName: nameForGroup(group),
    }));

    await this.repo().update(id, {
      columnMapping: { ...dataset.columnMapping, mediaColumns: newMediaColumns },
      channelCombinations: [...(dataset.channelCombinations ?? []), ...newCombinations],
      channelHyperparameters: null,
    });

    return { dataset: await this.findOne(id, requesterId, globalRole), combined: newCombinations };
  }

  /**
   * Soft delete only, same audit-trail rationale as `ProjectsService`, the
   * row stays. The R2 object itself is left in place deliberately, not
   * removed on every dataset delete, matching that same "keep it for
   * audit" reasoning rather than assuming delete always means gone. Access-checked the same as
   * every other write — real project access plus a Read/Write (or Master) role, already enforced
   * by `assertWriteAccess()` at the controller — not owner-exclusive the way it used to be, now
   * that real project membership exists.
   */
  async remove(id: string, requesterId: string, globalRole: GlobalRole): Promise<void> {
    await this.findOne(id, requesterId, globalRole);
    await this.repo().softDelete(id);
  }

  /**
   * The Configure step (CMP-79-adjacent). This is the piece Save
   * Configuration had nothing to call before today.
   */
  async configure(id: string, requesterId: string, globalRole: GlobalRole, dto: ConfigureDatasetDto): Promise<Dataset> {
    await this.findOne(id, requesterId, globalRole);

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
    return this.findOne(id, requesterId, globalRole);
  }

  /** The Optimize step: the date range the training run actually uses. */
  async optimize(id: string, requesterId: string, globalRole: GlobalRole, dto: OptimizeDatasetDto): Promise<Dataset> {
    await this.findOne(id, requesterId, globalRole);
    assertValidDateRange(dto.startDate, dto.endDate);

    await this.repo().update(id, { dateRange: { startDate: dto.startDate, endDate: dto.endDate } });
    return this.findOne(id, requesterId, globalRole);
  }

  /** The Calibrate step: model_configuration.calibration. */
  async calibrate(id: string, requesterId: string, globalRole: GlobalRole, dto: CalibrateDatasetDto): Promise<Dataset> {
    await this.findOne(id, requesterId, globalRole);

    await this.repo().update(id, {
      calibration: {
        contributionBeliefPercent: dto.contributionBeliefPercent,
        confidencePercent: dto.confidencePercent,
      },
    });
    return this.findOne(id, requesterId, globalRole);
  }

  /**
   * The Hyperparameterization step: model_configuration.channels. Requires
   * Configure to already be saved, and requires the channel names to be
   * exactly the media columns Configure named, no more, no fewer, since
   * Hammad's model needs one carryover/saturation pair per real media
   * channel, not an arbitrary list.
   */
  async hyperparameterize(
    id: string,
    requesterId: string,
    globalRole: GlobalRole,
    dto: HyperparameterizeDatasetDto,
  ): Promise<Dataset> {
    const dataset = await this.findOne(id, requesterId, globalRole);

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
    return this.findOne(id, requesterId, globalRole);
  }

  /**
   * CMP-79: the one real piece of backend work Hammad's contract still needs. Builds the actual
   * JSON file his worker would read, saves it to storage, and generates a real job_id (our side
   * generates it, confirmed directly with Hammad 2026-08-12) — but does not send it anywhere.
   * There's nowhere stable to send it yet: his worker only exists behind a Colab/ngrok bridge he
   * doesn't actively manage. This stops at the real artifact so it can be inspected and confirmed
   * correct before the final "send it" step gets built, once there's a real address to send it to.
   */
  async assemble(
    id: string,
    requesterId: string,
    globalRole: GlobalRole,
  ): Promise<{ jobId: string; datasetReference: string; payload: unknown }> {
    const dataset = await this.findOne(id, requesterId, globalRole);

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
    const dateFiltered = filterRowsByDateRange(
      allRows,
      dataset.columnMapping!.dateColumn,
      dataset.dateRange!.startDate,
      dataset.dateRange!.endDate,
    );
    // Real combined channels get summed into their new column and the originals dropped here,
    // matching columnMapping.mediaColumns (already updated by combineChannels()) — without this,
    // a "combined" channel still reaches Meridian as separate, collinear raw columns.
    const rows = applyChannelCombinations(dateFiltered, dataset.channelCombinations);
    const payload = buildJobPayload(dataset, rows);

    const jobId = randomUUID();
    const datasetReference = `tenants/${dataset.tenantId}/projects/${dataset.projectId}/datasets/${dataset.id}/jobs/${jobId}.json`;
    await this.storage.upload(datasetReference, Buffer.from(JSON.stringify(payload, null, 2)), 'application/json');
    await this.repo().update(id, { jobId, datasetReference });

    return { jobId, datasetReference, payload };
  }

  /**
   * Triggers Meridian model training. Calls the live Colab FastAPI endpoint over ngrok
   * (`POST /train`), passing a real downloadable R2 link, not our internal storage key — his
   * engine fetches over HTTP, it has no access to our bucket directly. Colab's `/train` returns
   * immediately (`{"status": "accepted"}`, training runs in a background task on his side), so
   * this call is fast either way, not a wait for training to finish.
   *
   * Real policy, Anas 2026-08-24: "we will never use mock numbers anywhere, always real now."
   * The mock fallback that used to run here on a misconfigured or unreachable engine is gone —
   * if the real engine can't be reached, this throws a real error instead of quietly starting a
   * "run" that was never going to produce anything but fake numbers.
   *
   * Refuses to start a second run while one is already in progress. Real bug found in testing:
   * nothing on our side or Colab's queues jobs, so two real Meridian trainings could run
   * concurrently on the same GPU process and crash each other — confirmed live, one job's log
   * started sampling before the previous job had finished. This is the guard against that.
   */
  async train(id: string, requesterId: string, globalRole: GlobalRole): Promise<Dataset> {
    const existing = await this.findOne(id, requesterId, globalRole);
    if (existing.trainingStartedAt) {
      const { status } = await this.getTrainingStatus(id, requesterId, globalRole);
      if (status === TrainingStatus.RUNNING) {
        throw new BadRequestException(
          'Training is already running for this dataset. Wait for it to finish before starting another run.',
        );
      }
    }

    const { jobId, datasetReference } = await this.assemble(id, requesterId, globalRole);

    const modelEngineUrl = process.env.MODEL_ENGINE_URL;
    if (!modelEngineUrl) {
      throw new BadRequestException('The model engine is not configured. Training cannot start.');
    }

    let res: Response;
    try {
      const downloadUrl = await this.storage.getDownloadUrl(datasetReference);
      res = await fetch(`${modelEngineUrl}/train`, {
        method: 'POST',
        headers: modelEngineHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ job_id: jobId, dataset_reference: downloadUrl }),
      });
    } catch (err) {
      throw new BadRequestException(`Could not reach the model engine to start training: ${err}`);
    }
    if (!res.ok) {
      throw new BadRequestException(`The model engine rejected the training request (status ${res.status}).`);
    }

    await this.repo().update(id, {
      trainingStatus: TrainingStatus.RUNNING,
      trainingStartedAt: new Date(),
      trainedByUserId: requesterId,
      notifiedAt: null,
    });
    return this.findOne(id, requesterId, globalRole);
  }

  /**
   * Queries status of a real training job against Colab's `/status/:jobId`, passing through a
   * real "failed" status and error message — Colab's own `job_processor.py` writes exactly that
   * when validation or training genuinely fails.
   *
   * Real policy, Anas 2026-08-24: "we will never use mock numbers anywhere, always real now."
   * The elapsed-time fake-progress fallback that used to run here on a transient network error is
   * gone — a real hiccup reaching the engine now reports "still running, progress unknown" rather
   * than inventing a percentage. The job's own real trainingStatus in the database (RUNNING) is
   * still trustworthy even when this one poll couldn't reach the engine; only an explicit
   * engine-reported failure or a confirmed-dead job (404) marks it FAILED.
   */
  async getTrainingStatus(
    id: string,
    requesterId: string,
    globalRole: GlobalRole,
  ): Promise<{ status: string; progress: number; jobId: string | null; errorMessage?: string | null }> {
    const dataset = await this.findOne(id, requesterId, globalRole);
    if (!dataset.trainingStartedAt) {
      return { status: TrainingStatus.NOT_STARTED, progress: 0, jobId: dataset.jobId };
    }

    const modelEngineUrl = process.env.MODEL_ENGINE_URL;
    if (!modelEngineUrl || !dataset.jobId) {
      throw new BadRequestException('The model engine is not configured. Cannot check real training status.');
    }

    try {
      const res = await fetch(`${modelEngineUrl}/status/${dataset.jobId}`, {
        headers: modelEngineHeaders(),
      });
      if (res.ok) {
        const data = (await res.json()) as { status: string; progress: number; error_message?: string | null };
        const status =
          data.status === 'completed'
            ? TrainingStatus.COMPLETED
            : data.status === 'failed'
              ? TrainingStatus.FAILED
              : TrainingStatus.RUNNING;

        if (status === TrainingStatus.FAILED) {
          // Only place a real failure is first observed — getResults() never gets called for a
          // job that failed before producing anything, so the completion email's persist-then-
          // notify path can't cover this case, it needs its own.
          await this.repo().update(id, { trainingStatus: TrainingStatus.FAILED });
          await this.notifyIfNeeded(id, TrainingStatus.FAILED, data.error_message);
        }

        return { status, progress: data.progress ?? 0, jobId: dataset.jobId, errorMessage: data.error_message };
      }

      // A 404 here means the engine has never heard of this job_id — always a dead job, never
      // transient, because the only real cause is the Colab process having restarted since the
      // job was submitted (its job registry lives only in that process's memory, nothing durable
      // backs it). Reported as a real, permanent failure, same path as an engine-reported
      // failure, so notifyIfNeeded still fires.
      if (res.status === 404) {
        const errorMessage =
          'This training run is no longer known to the model engine, most likely because the ' +
          'Colab session restarted since it was submitted. Start training again.';
        await this.repo().update(id, { trainingStatus: TrainingStatus.FAILED });
        await this.notifyIfNeeded(id, TrainingStatus.FAILED, errorMessage);
        return { status: TrainingStatus.FAILED, progress: 0, jobId: dataset.jobId, errorMessage };
      }

      throw new BadRequestException(`The model engine responded with status ${res.status}.`);
    } catch (err) {
      // A real network hiccup reaching the engine doesn't mean the job died — Colab's own
      // background training keeps running regardless of whether this one poll landed. Report
      // "still running, progress unknown" rather than failing the whole job or faking a number.
      console.error('Failed to query MODEL_ENGINE_URL status:', err);
      return {
        status: TrainingStatus.RUNNING,
        progress: 0,
        jobId: dataset.jobId,
        errorMessage: 'Could not reach the model engine just now — still checking, this is not a failure.',
      };
    }
  }

  /** Fetches real results of a completed model run from Colab's `/results/:jobId`. */
  async getResults(id: string, requesterId: string, globalRole: GlobalRole) {
    const dataset = await this.findOne(id, requesterId, globalRole);
    if (!dataset.trainingStartedAt) {
      throw new BadRequestException('Training has not started for this dataset yet.');
    }

    const modelEngineUrl = process.env.MODEL_ENGINE_URL;
    if (!modelEngineUrl || !dataset.jobId) {
      throw new BadRequestException('The model engine is not configured. Cannot fetch real results.');
    }

    let res: Response;
    try {
      res = await fetch(`${modelEngineUrl}/results/${dataset.jobId}`, {
        headers: modelEngineHeaders(),
      });
    } catch (err) {
      throw new BadRequestException(`Could not reach the model engine to fetch real results: ${err}`);
    }

    if (res.ok) {
      const liveResults = await res.json();
      await this.repo().update(id, {
        trainingStatus: TrainingStatus.COMPLETED,
        results: liveResults,
      });
      await this.notifyIfNeeded(id, TrainingStatus.COMPLETED);
      return liveResults;
    }

    if (dataset.trainingStatus === TrainingStatus.COMPLETED && dataset.results) {
      // Already confirmed completed and saved from a prior real poll — return the real stored
      // results rather than failing just because this particular re-fetch didn't succeed.
      return dataset.results;
    }

    throw new BadRequestException(
      `Training is still running, or the model engine could not be reached (status ${res.status}). Results are not ready yet.`,
    );
  }
}
