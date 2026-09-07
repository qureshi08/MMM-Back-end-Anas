import { CsvRow } from './parse-csv-rows';
import { correlation } from './suggest-channel-combinations';

export type ExposureDirection = 'helps' | 'hurts' | 'not_sure';

export interface ExposureMetric {
  column: string;
  correlation: number;
  suggestedDirection: ExposureDirection;
}

/**
 * Below this, a real correlation is treated as too weak to confidently call a direction — the
 * screen's own real copy: "Not sure is a safe default; the model will still learn a direction, it
 * just won't be nudged by you." A weak real correlation (mostly noise) shouldn't nudge anything.
 */
const NOT_SURE_THRESHOLD = 0.1;

/**
 * Real backend for the Exposure Metrics screen, built 2026-09-07 — same real gap as Channel
 * Health had: "does this column help or hurt your outcome" was showing a real UI with nothing
 * behind it. Runs the same real Pearson correlation Channel Health already uses for "combine
 * with," just between each real control/organic column and the real target column instead of
 * between two media columns.
 *
 * Deliberately covers both control and organic columns — both are real non-media inputs whose
 * direction genuinely matters (a holiday should help, a competitor's promotion should hurt), not
 * just the control columns shown in the one real example screenshot.
 */
export function computeExposureMetrics(rows: CsvRow[], targetColumn: string, columns: string[]): ExposureMetric[] {
  return columns.map((column) => {
    const r = correlation(rows, column, targetColumn);
    const suggestedDirection: ExposureDirection =
      Math.abs(r) < NOT_SURE_THRESHOLD ? 'not_sure' : r > 0 ? 'helps' : 'hurts';
    return { column, correlation: r, suggestedDirection };
  });
}
