import { CsvRow } from './parse-csv-rows';

export interface SuggestedHyperparameter {
  channel: string;
  carryover: number | null;
  saturation: number | null;
}

/**
 * Replaces "Automatic Optimization"'s old client-side random draw (`current ± variance%`, picked
 * with no real data behind it) with a real, deterministic estimate off this channel's own actual
 * spend history — confirmed as a genuine gap with Anas 2026-09-08: once real training was
 * connected, an honestly-labeled random guess for the *starting* value stopped being good enough.
 * This is still a heuristic, not a Bayesian fit — Meridian's own training is what actually finds
 * the real answer — but it's now a real number derived from this channel's real weeks of spend,
 * not a coin flip inside a range.
 */

/** Real Pearson correlation between a series and itself shifted by `lag` real time steps. */
export function laggedAutocorrelation(values: number[], lag: number): number {
  if (lag <= 0 || values.length <= lag) return 0;
  const a = values.slice(0, values.length - lag);
  const b = values.slice(lag);

  const n = a.length;
  const meanA = a.reduce((sum, v) => sum + v, 0) / n;
  const meanB = b.reduce((sum, v) => sum + v, 0) / n;

  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    cov += (a[i] - meanA) * (b[i] - meanB);
    varA += (a[i] - meanA) ** 2;
    varB += (b[i] - meanB) ** 2;
  }

  const denominator = Math.sqrt(varA * varB);
  return denominator === 0 ? 0 : cov / denominator;
}

/**
 * Real signal: how much this channel's own real spend from one week still resembles the next
 * week's real spend. A channel run as a sustained, continuous campaign (broad TV, brand search)
 * has real spend that stays similar week to week — high lag-1 autocorrelation — and those are
 * exactly the channels where the underlying advertising effect also tends to keep working longer
 * after the money's spent. A channel bought in short, spiky bursts (a single promotion, a flighted
 * push) has real spend that swings a lot week to week — low autocorrelation — and tends to have a
 * shorter real carryover too. Clamped to [0, 0.95]: 1.0 would mean the effect never fades at all,
 * which Meridian's own model doesn't allow either.
 */
export function estimateCarryover(spendSeries: number[]): number | null {
  const real = spendSeries.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (real.length < 4) return null;

  const r = laggedAutocorrelation(real, 1);
  return Math.round(Math.max(0, Math.min(0.95, r)) * 100) / 100;
}

/**
 * Real signal: how spiky this channel's real spend has been, measured as its own coefficient of
 * variation (stdev ÷ mean) across the real non-zero weeks. A channel spent at a steady, consistent
 * real level week to week (low CV) is read as further from any real ceiling — gamma near 1, a
 * gentler real flattening curve. A channel with wildly uneven real spend (high CV, alternating
 * near-zero and very high weeks) is read as more likely to have hit a real ceiling on its highest
 * real weeks — a lower gamma, a faster real flattening. This is the real `saturation` field
 * (the app's own "Gamma" slider) — never the separate, purely illustrative "Alpha" slider, which
 * the frontend already keeps local-only.
 */
export function estimateSaturation(spendSeries: number[]): number | null {
  const real = spendSeries.filter((v) => typeof v === 'number' && !Number.isNaN(v) && v > 0);
  if (real.length < 4) return null;

  const mean = real.reduce((sum, v) => sum + v, 0) / real.length;
  if (mean === 0) return null;
  const variance = real.reduce((sum, v) => sum + (v - mean) ** 2, 0) / real.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;

  const gamma = 1 / (1 + coefficientOfVariation);
  return Math.round(Math.max(0.3, Math.min(2.5, gamma)) * 100) / 100;
}

/**
 * One real estimate per real media column, in the real chronological order the date column
 * already established — `rows` must already be date-sorted and date-range-filtered the same way
 * Optimize's own training window is, so the estimate reflects the real weeks that will actually
 * train, not the whole raw file.
 */
export function suggestHyperparameters(rows: CsvRow[], mediaColumns: string[]): SuggestedHyperparameter[] {
  return mediaColumns.map((channel) => {
    const spendSeries = rows.map((row) => row[channel]).filter((v): v is number => typeof v === 'number');
    return {
      channel,
      carryover: estimateCarryover(spendSeries),
      saturation: estimateSaturation(spendSeries),
    };
  });
}
