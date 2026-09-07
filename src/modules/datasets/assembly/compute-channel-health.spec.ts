import { computeChannelHealth } from './compute-channel-health';

describe('computeChannelHealth', () => {
  it('gives a real, large VIF to a channel that is an exact linear copy of another', () => {
    // tv_spend is exactly 2x google_spend on every real row — perfectly predictable from it.
    const rows = Array.from({ length: 20 }, (_, i) => ({
      google_spend: 100 + i * 7,
      tv_spend: (100 + i * 7) * 2,
    }));
    const health = computeChannelHealth(rows, ['google_spend', 'tv_spend']);

    const tv = health.find((h) => h.channel === 'tv_spend')!;
    expect(tv.vif).not.toBeNull();
    expect(tv.vif!).toBeGreaterThan(50); // real near-perfect collinearity
    expect(tv.mostCorrelatedWith).toBe('google_spend');
    expect(tv.mostCorrelatedValue!).toBeCloseTo(1, 2);
  });

  it('gives a real, low VIF to a channel with no real relationship to the others', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      google_spend: 100 + i * 7,
      display_spend: (i % 5) * 33 + 10, // unrelated real noise, not derived from google_spend
    }));
    const health = computeChannelHealth(rows, ['google_spend', 'display_spend']);

    const display = health.find((h) => h.channel === 'display_spend')!;
    expect(display.vif).not.toBeNull();
    expect(display.vif!).toBeLessThan(5); // real independent channel, low redundancy
  });

  it('returns null VIF for every channel when two OTHER real channels are exactly collinear (the regression genuinely has no unique answer)', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      google_spend: 100 + i * 7,
      tv_spend: (100 + i * 7) * 2, // exact copy of google_spend
      display_spend: (i % 5) * 33 + 10,
    }));
    const health = computeChannelHealth(rows, ['google_spend', 'tv_spend', 'display_spend']);
    // display_spend is regressed against {google_spend, tv_spend}, which are themselves an exact
    // linear pair — that design matrix is singular, so this real answer is "can't tell", not a guess.
    expect(health.find((h) => h.channel === 'display_spend')!.vif).toBeNull();
  });

  it('computes a real share of spend across all real channels', () => {
    const rows = [
      { a: 100, b: 300 },
      { a: 100, b: 300 },
    ];
    const health = computeChannelHealth(rows, ['a', 'b']);
    expect(health.find((h) => h.channel === 'a')!.shareOfSpendPercent).toBeCloseTo(25, 5);
    expect(health.find((h) => h.channel === 'b')!.shareOfSpendPercent).toBeCloseTo(75, 5);
  });

  it('returns null VIF when there is only one real media column, not a crash', () => {
    const rows = [{ a: 10 }, { a: 20 }];
    const health = computeChannelHealth(rows, ['a']);
    expect(health[0].vif).toBeNull();
    expect(health[0].mostCorrelatedWith).toBeNull();
  });
});
