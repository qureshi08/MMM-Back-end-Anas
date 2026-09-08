import { Dataset } from '../entities/dataset.entity';
import { CsvRow } from './parse-csv-rows';

/**
 * The one real JSON file Hammad's worker reads, exactly the shape in his own API Contracts v6
 * document — snake_case keys, `channels` as an object keyed by channel name (not the array our own
 * `channelHyperparameters` column stores internally, that's an internal shape, this is the real
 * wire contract). Everything here comes from a dataset that's already passed through Configure and
 * Optimize — Calibrate and Hyperparameterization are genuinely optional per Hammad's contract
 * (2026-09-08), so `calibration` and `channelHyperparameters` may both be null/empty here.
 */
export function buildJobPayload(dataset: Dataset, rows: CsvRow[]) {
  const columnMapping = dataset.columnMapping!;
  const calibration = dataset.calibration;

  const channels: Record<string, { carryover?: number; saturation?: number }> = {};
  for (const c of dataset.channelHyperparameters ?? []) {
    const entry: { carryover?: number; saturation?: number } = {};
    if (c.carryover !== null && c.carryover !== undefined) entry.carryover = c.carryover;
    if (c.saturation !== null && c.saturation !== undefined) entry.saturation = c.saturation;
    channels[c.channel] = entry;
  }

  return {
    df: rows,
    column_mapping: {
      date_column: columnMapping.dateColumn,
      target_column: columnMapping.targetColumn,
      media_columns: columnMapping.mediaColumns,
      control_columns: columnMapping.controlColumns,
      organic_columns: columnMapping.organicColumns,
      geo_columns: columnMapping.geoColumns,
    },
    kpi_type: dataset.kpiType,
    revenue_per_kpi_value: dataset.revenuePerKpiValue ?? null,
    model_configuration: {
      channels,
      calibration: {
        contribution_belief_percent: calibration?.contributionBeliefPercent ?? null,
        confidence_percent: calibration?.confidencePercent ?? null,
      },
    },
    // target_budget: never collected from the user anywhere in the flow — Cassandra treats budget
    // allocation as its own separate feature (Budget Allocator) — but Hammad's contract requires
    // the key to always be present in the payload, so it's always sent as a real null, not omitted.
    target_budget: null,
  };
}
