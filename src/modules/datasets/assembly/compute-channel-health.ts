import { CsvRow } from './parse-csv-rows';
import { correlation } from './suggest-channel-combinations';
import { addRidgePenalty, solveLinearSystem, transposeTimesSelf, transposeTimesVector } from './linear-algebra';

export interface ChannelHealth {
  channel: string;
  shareOfSpendPercent: number;
  /** Real Variance Inflation Factor — how much this channel's own spend can be predicted from every
   * other real channel's spend. Null only when there's genuinely nothing to compute it from: one
   * real media channel total, or fewer real rows than channels. */
  vif: number | null;
  /** True when `vif` came from the real ridge-regularized fallback below, not the plain textbook
   * VIF formula — real, exact collinearity among the *other* channels made the plain version
   * mathematically undefined. Still a real, computed number, just worth a softer real caveat in
   * the UI ("approximate") rather than presenting it with the same confidence as the plain case. */
  vifIsApproximate: boolean;
  /** The single other real channel this one correlates with most strongly, for the "combine with
   * X" suggestion — null if there's no other real channel or every correlation is exactly zero. */
  mostCorrelatedWith: string | null;
  mostCorrelatedValue: number | null;
}

/**
 * Real backend for the Channel Health screen, built 2026-09-07 — until now this screen (VIF
 * scatter chart, spend-cutoff/VIF-cutoff sliders, per-channel "combine with X" suggestions) had
 * nothing behind it at all; Anas found this live, end-to-end testing a real Meridian run: "Channel
 * health section is not connected with the backend."
 *
 * Two real, independent problems this one chart is built to show at once, matching the screen's
 * own real copy ("a channel can be redundant with others, too small to trust, or both"):
 *
 * 1. **Redundancy** — a real Variance Inflation Factor per channel, computed by regressing that
 *    channel's own real spend against every other real media channel's spend (ordinary least
 *    squares, solved via the normal equations) and converting the fit into VIF = 1 / (1 - R²). A
 *    channel whose spend can be predicted almost perfectly from the others (high R², so VIF blows
 *    up) is exactly the situation Meridian itself rejects training over — this is the same real
 *    statistical idea, computed on our side so it's visible before Train Model, not just discovered
 *    when the engine refuses the file.
 * 2. **Low trust** — real share of total spend. A channel that's 1% of the budget doesn't give the
 *    model enough real variation to learn a trustworthy effect from, independent of whether it's
 *    correlated with anything else.
 *
 * Returns raw real numbers, not a fixed cutoff/flag — the screen's own sliders (spend cutoff, VIF
 * cutoff) are a real, instant, client-side threshold on these same numbers, not a setting that
 * should round-trip to the server on every drag.
 */
export function computeChannelHealth(rows: CsvRow[], mediaColumns: string[]): ChannelHealth[] {
  const spendByChannel = new Map<string, number>();
  for (const channel of mediaColumns) {
    let total = 0;
    for (const row of rows) {
      const value = row[channel];
      if (typeof value === 'number') total += value;
    }
    spendByChannel.set(channel, total);
  }
  const totalSpend = [...spendByChannel.values()].reduce((sum, v) => sum + v, 0);

  return mediaColumns.map((channel) => {
    const shareOfSpendPercent = totalSpend > 0 ? ((spendByChannel.get(channel) ?? 0) / totalSpend) * 100 : 0;

    let mostCorrelatedWith: string | null = null;
    let mostCorrelatedValue: number | null = null;
    for (const other of mediaColumns) {
      if (other === channel) continue;
      const r = correlation(rows, channel, other);
      if (mostCorrelatedValue === null || Math.abs(r) > Math.abs(mostCorrelatedValue)) {
        mostCorrelatedWith = other;
        mostCorrelatedValue = r;
      }
    }

    const { vif, vifIsApproximate } = computeVif(rows, channel, mediaColumns);
    return {
      channel,
      shareOfSpendPercent,
      vif,
      vifIsApproximate,
      mostCorrelatedWith,
      mostCorrelatedValue,
    };
  });
}

/**
 * Real fallback, added 2026-09-07 after Amna asked directly: the plain textbook VIF is undefined
 * (not just "hard to compute") when two *other* real channels are themselves exactly collinear —
 * the regression genuinely has no unique answer. A small real ridge penalty on the normal
 * equations' diagonal breaks that tie with a minimal, principled nudge, rather than picking an
 * arbitrary one of the infinitely many equally-valid answers. Only used when the plain version
 * fails — a well-defined case is never regularized, so it never gets a different number than
 * before this fallback existed.
 */
function computeVif(
  rows: CsvRow[],
  channel: string,
  mediaColumns: string[],
): { vif: number | null; vifIsApproximate: boolean } {
  const others = mediaColumns.filter((c) => c !== channel);
  if (others.length === 0) return { vif: null, vifIsApproximate: false }; // nothing real to regress against — a structural fact, not a fixable gap

  const numericRows = rows.filter(
    (row) => typeof row[channel] === 'number' && others.every((c) => typeof row[c] === 'number'),
  );
  if (numericRows.length <= others.length + 1) return { vif: null, vifIsApproximate: false }; // not enough real rows for a stable fit, regularizing this wouldn't make it a real answer

  const y = numericRows.map((row) => row[channel] as number);
  const x = numericRows.map((row) => [1, ...others.map((c) => row[c] as number)]); // 1 = intercept column
  const xtx = transposeTimesSelf(x);
  const xty = transposeTimesVector(x, y);

  let beta = solveLinearSystem(xtx, xty);
  let vifIsApproximate = false;
  if (!beta) {
    const avgDiagonal = xtx.reduce((sum, row, i) => sum + row[i], 0) / xtx.length;
    const lambda = (avgDiagonal || 1) * 1e-6;
    beta = solveLinearSystem(addRidgePenalty(xtx, lambda), xty);
    vifIsApproximate = true;
  }
  if (!beta) return { vif: null, vifIsApproximate: false }; // real edge case even ridge can't rescue — genuinely nothing to say

  const meanY = y.reduce((sum, v) => sum + v, 0) / y.length;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < y.length; i++) {
    const predicted = x[i].reduce((sum, xij, j) => sum + xij * beta![j], 0);
    ssRes += (y[i] - predicted) ** 2;
    ssTot += (y[i] - meanY) ** 2;
  }

  if (ssTot === 0) return { vif: null, vifIsApproximate: false }; // this channel never varies — VIF is meaningless, not infinite
  const rSquared = Math.min(1 - ssRes / ssTot, 0.999); // clamp — a regularized fit can nudge R^2 fractionally past 1 in a near-perfect real case
  if (rSquared >= 0.999) return { vif: 999, vifIsApproximate }; // real, near-exact collinearity — cap rather than return Infinity (not valid JSON)
  return { vif: 1 / (1 - rSquared), vifIsApproximate };
}
