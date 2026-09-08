import { BadRequestException } from '@nestjs/common';
import { KpiType } from '../entities/dataset.entity';

/**
 * Configure: Hammad's contract, word for word: "required only if kpi_type is non_revenue;
 * otherwise null." A revenue KPI is already in dollars, converting it to dollars again is
 * meaningless, so the field must be absent there, not just optional.
 */
export function assertRevenuePerKpiValueMatchesKpiType(
  kpiType: KpiType,
  revenuePerKpiValue: number | undefined,
): void {
  if (kpiType === KpiType.NON_REVENUE && (revenuePerKpiValue === undefined || revenuePerKpiValue === null)) {
    throw new BadRequestException(
      'revenuePerKpiValue is required when kpiType is "non_revenue" — the real dollar value of one unit of this KPI.',
    );
  }
  if (kpiType === KpiType.REVENUE && revenuePerKpiValue !== undefined && revenuePerKpiValue !== null) {
    throw new BadRequestException(
      'revenuePerKpiValue must be left out when kpiType is "revenue" — the KPI is already in dollars.',
    );
  }
}

/** Configure: date, target, media, control and organic columns must each mean one real thing. */
export function assertNoDuplicateColumns(allColumns: string[]): void {
  const unique = new Set(allColumns);
  if (unique.size !== allColumns.length) {
    throw new BadRequestException(
      'The same column name is used more than once across date, target, media, control and organic. Each column can only mean one thing.',
    );
  }
}

/** Optimize: the training run needs a real, forward-moving window. */
export function assertValidDateRange(startDate: string, endDate: string): void {
  if (new Date(startDate) >= new Date(endDate)) {
    throw new BadRequestException('The start date must be before the end date.');
  }
}

/**
 * Exposure Metrics: the same real "exactly these columns, no more, no fewer" shape as
 * hyperparameters below, just against the real control + organic columns instead of media ones.
 */
export function assertColumnsMatchExposureColumns(exposureColumns: string[], submitted: string[]): void {
  const uniqueSubmitted = new Set(submitted);
  if (uniqueSubmitted.size !== submitted.length) {
    throw new BadRequestException('The same column is listed more than once.');
  }

  const expected = new Set(exposureColumns);
  const missing = [...expected].filter((c) => !uniqueSubmitted.has(c));
  const unexpected = submitted.filter((c) => !expected.has(c));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new BadRequestException(
      `Directions must exactly match the real control and organic columns from Configure. Missing: [${missing.join(', ') || 'none'}]. Not a real control/organic column: [${unexpected.join(', ') || 'none'}].`,
    );
  }
}

/**
 * Hyperparameterization: real contract confirmed by Hammad 2026-09-08 — a channel only needs to
 * appear here if the user actually set something real for it; "no input to any channel" (an empty
 * list) is a real, valid choice, and Hammad's own engine computes real defaults for every media
 * column not mentioned. This is now a real *subset* check, not an exact-match one: every channel
 * named here must be a real media column from Configure, and none may repeat, but not every real
 * media column needs an entry.
 */
export function assertChannelsAreRealMediaColumns(mediaColumns: string[], channels: string[]): void {
  const uniqueChannels = new Set(channels);
  if (uniqueChannels.size !== channels.length) {
    throw new BadRequestException('The same channel is listed more than once.');
  }

  const expected = new Set(mediaColumns);
  const unexpected = channels.filter((c) => !expected.has(c));
  if (unexpected.length > 0) {
    throw new BadRequestException(`Not a real media column from Configure: [${unexpected.join(', ')}].`);
  }
}

/**
 * Hyperparameterization: a channel entry with neither carryover nor saturation set is
 * meaningless — real contract confirmed 2026-09-08, "no input to a channel" means the channel
 * doesn't appear in the list at all, not that it appears with both fields empty.
 */
export function assertChannelHyperparameterHasAtLeastOneField(
  channel: string,
  carryover: number | null | undefined,
  saturation: number | null | undefined,
): void {
  if ((carryover === undefined || carryover === null) && (saturation === undefined || saturation === null)) {
    throw new BadRequestException(
      `"${channel}" has neither carryover nor saturation set — leave it out of the list entirely instead.`,
    );
  }
}

/**
 * Calibration: Hammad's real contract, word for word: "The user must either provide both or
 * None. He cannot provide one of the above only." A real belief without a real confidence (or the
 * reverse) isn't a usable calibration input, so both-or-neither is enforced as one real rule here,
 * not left to two independent optional fields that could each be set alone.
 */
export function assertCalibrationBothOrNeither(
  contributionBeliefPercent: number | null | undefined,
  confidencePercent: number | null | undefined,
): void {
  const hasBelief = contributionBeliefPercent !== undefined && contributionBeliefPercent !== null;
  const hasConfidence = confidencePercent !== undefined && confidencePercent !== null;
  if (hasBelief !== hasConfidence) {
    throw new BadRequestException(
      'Provide both contributionBeliefPercent and confidencePercent together, or leave both out — not just one.',
    );
  }
}
