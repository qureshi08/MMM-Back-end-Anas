import { CsvRow } from './parse-csv-rows';

/** Real Pearson correlation between two real numeric columns, pairwise-deleting any row where either side isn't a number. */
function correlation(rows: CsvRow[], colA: string, colB: string): number {
  const pairs = rows
    .map((row) => [row[colA], row[colB]])
    .filter((pair): pair is [number, number] => typeof pair[0] === 'number' && typeof pair[1] === 'number');

  if (pairs.length < 2) return 0;

  const n = pairs.length;
  const meanA = pairs.reduce((sum, [a]) => sum + a, 0) / n;
  const meanB = pairs.reduce((sum, [, b]) => sum + b, 0) / n;

  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (const [a, b] of pairs) {
    cov += (a - meanA) * (b - meanB);
    varA += (a - meanA) ** 2;
    varB += (b - meanB) ** 2;
  }

  const denominator = Math.sqrt(varA * varB);
  return denominator === 0 ? 0 : cov / denominator;
}

/**
 * Groups real media columns whose pairwise correlation meets or exceeds `threshold` (default 0.9,
 * i.e. 90%) into connected clusters — if A-B and B-C both correlate highly, all three group together,
 * not just pairs. Only ever looks at media columns, never control/target/organic columns; combining
 * those isn't a real product decision this feature makes. This is the same real row data and the
 * same correlation math the Optimize screen's own table already shows, just applied automatically
 * instead of requiring someone to notice and click each pair by hand.
 */
export function suggestChannelGroups(rows: CsvRow[], mediaColumns: string[], threshold = 0.9): string[][] {
  const parent = new Map<string, string>();
  mediaColumns.forEach((c) => parent.set(c, c));

  function find(x: string): string {
    while (parent.get(x) !== x) {
      const next = parent.get(x)!;
      parent.set(x, parent.get(next)!);
      x = next;
    }
    return x;
  }
  function union(x: string, y: string): void {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent.set(rx, ry);
  }

  for (let i = 0; i < mediaColumns.length; i++) {
    for (let j = i + 1; j < mediaColumns.length; j++) {
      if (Math.abs(correlation(rows, mediaColumns[i], mediaColumns[j])) >= threshold) {
        union(mediaColumns[i], mediaColumns[j]);
      }
    }
  }

  const groups = new Map<string, string[]>();
  for (const column of mediaColumns) {
    const root = find(column);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(column);
  }

  return [...groups.values()].filter((group) => group.length >= 2);
}

/** A short, readable name for an auto-combined channel: first word of each source column, joined. */
export function nameForGroup(group: string[]): string {
  const parts = group.map((c) => c.split('_')[0]);
  return `${parts.join('_')}_combined`;
}
