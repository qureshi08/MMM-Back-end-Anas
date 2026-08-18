import { ChannelCombination } from '../entities/dataset.entity';
import { CsvRow } from './parse-csv-rows';

/**
 * Applies real, saved "combine similar channels" decisions to real rows before the job file gets
 * built — sums each combination's source columns into its new column, per row, then removes the
 * originals. Without this, a "combined" channel still reaches Meridian as separate raw columns,
 * which is exactly what caused a real extreme-multicollinearity rejection, 2026-08-18.
 */
export function applyChannelCombinations(rows: CsvRow[], combinations: ChannelCombination[] | null): CsvRow[] {
  if (!combinations || combinations.length === 0) return rows;

  return rows.map((row) => {
    const next: CsvRow = { ...row };
    for (const { sourceColumns, newColumnName } of combinations) {
      const sum = sourceColumns.reduce((total, column) => {
        const value = next[column];
        return total + (typeof value === 'number' ? value : 0);
      }, 0);
      for (const column of sourceColumns) delete next[column];
      next[newColumnName] = sum;
    }
    return next;
  });
}
