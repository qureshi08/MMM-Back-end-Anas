import { Dataset, ModelType } from '../entities/dataset.entity';
import { CsvRow } from './parse-csv-rows';

/**
 * The one real JSON file each engine's worker reads. Same shape for both engines, with one real
 * exception found 2026-09-09: Meridian's contract wants `model_configuration.calibration` always
 * present (even as nulls); PyMC-Marketing's own real code (`pymc_calibrate.py`,
 * `pymc_run_pipeline.py`) has zero references to calibration anywhere — confirmed by reading its
 * source directly, not assumed from the sample JSON. Sending it to PyMC would be harmless (silently
 * ignored) but dishonest about what the field actually does, so it's only included for Meridian.
 *
 * `channels` as an object keyed by channel name (not the array our own `channelHyperparameters`
 * column stores internally, that's an internal shape, this is the real wire contract). Everything
 * here comes from a dataset that's already passed through Configure and Optimize — Calibrate and
 * Hyperparameterization are genuinely optional per Hammad's contract (2026-09-08), so `calibration`
 * and `channelHyperparameters` may both be null/empty here.
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

  const modelConfiguration: { channels: typeof channels; calibration?: { contribution_belief_percent: number | null; confidence_percent: number | null } } = {
    channels,
  };
  if (dataset.modelType !== ModelType.PYMC) {
    modelConfiguration.calibration = {
      contribution_belief_percent: calibration?.contributionBeliefPercent ?? null,
      confidence_percent: calibration?.confidencePercent ?? null,
    };
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
    model_configuration: modelConfiguration,
    // target_budget: never collected from the user anywhere in the flow — Cassandra treats budget
    // allocation as its own separate feature (Budget Allocator) — but Meridian's contract requires
    // the key to always be present in the payload, so it's always sent as a real null, not omitted.
    // PyMC's own real code (pymc_budget_allocation.py) requires target_budget and
    // target_budget_periods to travel together, or genuinely neither at all — sending this null with
    // target_budget_periods left out entirely still satisfies "neither," confirmed against its real
    // fallback branch, so this stays safe for PyMC too without needing a separate case.
    target_budget: null,
  };
}
