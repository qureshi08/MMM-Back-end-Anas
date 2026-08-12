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
 * Hyperparameterization: Hammad's model needs exactly one carryover/saturation
 * pair per real media channel, no more, no fewer, so the channel list has to
 * match Configure's media columns exactly.
 */
export function assertChannelsMatchMediaColumns(mediaColumns: string[], channels: string[]): void {
  const uniqueChannels = new Set(channels);
  if (uniqueChannels.size !== channels.length) {
    throw new BadRequestException('The same channel is listed more than once.');
  }

  const expected = new Set(mediaColumns);
  const missing = [...expected].filter((c) => !uniqueChannels.has(c));
  const unexpected = channels.filter((c) => !expected.has(c));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new BadRequestException(
      `Channels must exactly match the media columns from Configure. Missing: [${missing.join(', ') || 'none'}]. Not a real media column: [${unexpected.join(', ') || 'none'}].`,
    );
  }
}
