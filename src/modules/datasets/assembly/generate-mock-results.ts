import { TrainingResults } from '../entities/dataset.entity';

/**
 * Real training against Hammad's worker is on hold. This produces the exact real result shape
 * (copied field for field from his own sample output) filled with numbers computed from the real
 * uploaded data and the real carryover/saturation values the user actually set — deterministic, not
 * random, so the same dataset always produces the same mock result, and the numbers at least react
 * to real inputs instead of being pure noise. Every result carries `mock: true` and a data-quality
 * flag saying so, nobody should ever mistake this for a real trained model.
 */

interface JobPayload {
  df: Array<Record<string, string | number>>;
  column_mapping: {
    date_column: string;
    target_column: string;
    media_columns: string[];
    control_columns: string[];
    organic_columns: string[];
    geo_columns: string[];
  };
  model_configuration: {
    channels: Record<string, { carryover: number; saturation: number }>;
  };
}

/** A short display name, matching Hammad's own real file: "TV Cost" -> "TV", "Google Display Cost" -> "Google Display". */
function displayName(channel: string): string {
  return channel.replace(/\s*Cost$/i, '').trim();
}

/** Deterministic pseudo-random in [0, 1), seeded by a string, so the same dataset always mocks the same way. */
function seededFraction(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 10000) / 10000;
}

function carryoverLabel(carryover: number): string {
  if (carryover < 0.3) return 'short';
  if (carryover < 0.6) return 'medium';
  return 'long';
}

function saturationLabel(saturation: number): string {
  if (saturation < 0.8) return 'quickly';
  if (saturation < 1.5) return 'moderately';
  return 'slowly';
}

export function generateMockResults(payload: JobPayload): TrainingResults {
  const { df, column_mapping, model_configuration } = payload;
  const mediaColumns = column_mapping.media_columns;

  const dates = df.map((row) => String(row[column_mapping.date_column])).sort();
  const totalSpendByChannel: Record<string, number> = {};
  for (const channel of mediaColumns) {
    totalSpendByChannel[channel] = df.reduce((sum, row) => sum + (Number(row[channel]) || 0), 0);
  }
  const totalSpend = Object.values(totalSpendByChannel).reduce((a, b) => a + b, 0) || 1;

  const effectivenessByChannel: Record<string, number> = {};
  const incrementalByChannel: Record<string, number> = {};
  for (const channel of mediaColumns) {
    const hp = model_configuration.channels[channel] ?? { carryover: 0.3, saturation: 1 };
    const variance = 0.8 + seededFraction(channel) * 0.4;
    const effectiveness = Math.min(1.5, Math.max(0.1, hp.saturation * 0.5 + hp.carryover * 0.3)) * variance;
    effectivenessByChannel[channel] = effectiveness;
    incrementalByChannel[channel] = totalSpendByChannel[channel] * effectiveness;
  }
  const totalIncremental = Object.values(incrementalByChannel).reduce((a, b) => a + b, 0) || 1;

  return {
    data_used: {
      date_column: column_mapping.date_column,
      target_column: column_mapping.target_column,
      media_columns: mediaColumns,
      control_columns: column_mapping.control_columns,
      organic_columns: column_mapping.organic_columns,
      geo_columns: column_mapping.geo_columns,
      first_date: dates[0] ?? '',
      last_date: dates[dates.length - 1] ?? '',
      row_count: df.length,
    },
    model_confidence: {
      overall_accuracy_percent: 82 + seededFraction('accuracy') * 12,
      overall_accuracy_formula: '100% minus the average prediction error (MAPE)',
      average_error_percent: 8 + seededFraction('error') * 8,
      weighted_average_error_percent: 8 + seededFraction('weighted_error') * 8,
      r_squared: 0.55 + seededFraction('r2') * 0.3,
      adjusted_r_squared: 0.5 + seededFraction('adj_r2') * 0.3,
    },
    channel_contribution: mediaColumns.map((channel) => ({
      channel: displayName(channel),
      spend: totalSpendByChannel[channel],
      pct_of_spend: (totalSpendByChannel[channel] / totalSpend) * 100,
      incremental_outcome: incrementalByChannel[channel],
      pct_of_contribution: incrementalByChannel[channel] / totalIncremental,
    })),
    channel_efficiency: mediaColumns.map((channel) => {
      const spend = totalSpendByChannel[channel];
      const incremental = incrementalByChannel[channel];
      const roi = spend > 0 ? incremental / spend : 0;
      return {
        channel: displayName(channel),
        roi,
        marginal_roi: roi * (0.7 + seededFraction(channel + '_marginal') * 0.3),
        effectiveness: effectivenessByChannel[channel],
        cost_per_incremental_result: incremental > 0 ? spend / incremental : 0,
      };
    }),
    data_quality_flags: [
      {
        message:
          'These are simulated results for demo purposes. Hammad\'s real modeling engine has not been connected yet, see dev-log/raw/2026-08-11.md.',
        columns_involved: [],
      },
    ],
    budget_recommendation: mediaColumns.map((channel) => {
      const currentSpend = totalSpendByChannel[channel];
      const shiftPercent = (seededFraction(channel + '_shift') - 0.5) * 0.6; // -30% to +30%
      const optimizedSpend = Math.max(0, currentSpend * (1 + shiftPercent));
      const currentRoi = currentSpend > 0 ? incrementalByChannel[channel] / currentSpend : 0;
      return {
        channel: displayName(channel),
        current_spend: currentSpend,
        current_pct_of_budget: (currentSpend / totalSpend) * 100,
        optimized_spend: optimizedSpend,
        optimized_pct_of_budget: (optimizedSpend / totalSpend) * 100,
        spend_change_dollars: optimizedSpend - currentSpend,
        spend_change_percent: shiftPercent * 100,
        current_roi: currentRoi,
        optimized_roi: currentRoi * (1 + Math.abs(shiftPercent) * 0.2),
      };
    }),
    saturation_status: mediaColumns.map((channel) => {
      const hp = model_configuration.channels[channel] ?? { carryover: 0.3, saturation: 1 };
      return {
        channel: displayName(channel),
        carryover_label: carryoverLabel(hp.carryover),
        saturation_label: saturationLabel(hp.saturation),
      };
    }),
    adstock_decay_curves: mediaColumns.map((channel) => {
      const hp = model_configuration.channels[channel] ?? { carryover: 0.3, saturation: 1 };
      const weeks = [0, 0.2, 0.4, 0.6, 0.8, 1, 1.5, 2];
      return {
        channel: displayName(channel),
        curve: weeks.map((w) => ({
          weeks_since_spend: w,
          effect_remaining_percent: 100 * Math.pow(hp.carryover, w),
        })),
      };
    }),
    saturation_curves: mediaColumns.map((channel) => {
      const hp = model_configuration.channels[channel] ?? { carryover: 0.3, saturation: 1 };
      const maxSpend = Math.max(...df.map((row) => Number(row[channel]) || 0), 1);
      const scale = maxSpend * hp.saturation;
      const points = [0, 0.25, 0.5, 0.75, 1].map((f) => {
        const spendLevel = maxSpend * f;
        return { spend_level: spendLevel, effect: 1 - Math.exp(-spendLevel / (scale || 1)) };
      });
      const spends = df.map((row) => Number(row[channel]) || 0).sort((a, b) => a - b);
      const bucketCount = 4;
      const distribution = Array.from({ length: bucketCount }, (_, i) => {
        const start = spends[Math.floor((spends.length * i) / bucketCount)] ?? 0;
        const end = spends[Math.floor((spends.length * (i + 1)) / bucketCount) - 1] ?? start;
        return {
          spend_range_start: start,
          spend_range_end: end,
          relative_frequency_percent: 100 / bucketCount,
        };
      });
      return { channel: displayName(channel), curve: points, historical_spend_distribution: distribution };
    }),
    status: 'completed',
    mock: true,
  };
}
