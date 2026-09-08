import {
  estimateCarryover,
  estimateSaturation,
  laggedAutocorrelation,
  suggestHyperparameters,
} from './suggest-hyperparameters';

describe('laggedAutocorrelation', () => {
  it('is 0 for a lag of 0 or a series shorter than the lag', () => {
    expect(laggedAutocorrelation([1, 2, 3], 0)).toBe(0);
    expect(laggedAutocorrelation([1, 2], 5)).toBe(0);
  });

  it('matches a real hand-computed value for a smoothly rising real series', () => {
    const spend = [100, 105, 110, 108, 112, 115, 118, 120, 117, 122];
    expect(laggedAutocorrelation(spend, 1)).toBeCloseTo(0.8897, 4);
  });
});

describe('estimateCarryover', () => {
  it('returns null with fewer than 4 real weeks — not enough real data for a real signal', () => {
    expect(estimateCarryover([100, 110, 90])).toBeNull();
  });

  it('reads a smoothly sustained real spend pattern as high real carryover', () => {
    const spend = [100, 105, 110, 108, 112, 115, 118, 120, 117, 122];
    expect(estimateCarryover(spend)).toBeCloseTo(0.89, 2);
  });

  it('never exceeds the real 0.95 ceiling, even for a perfectly smooth real series', () => {
    const spend = [100, 101, 102, 103, 104, 105, 106, 107];
    const result = estimateCarryover(spend)!;
    expect(result).toBeLessThanOrEqual(0.95);
  });

  it('clamps a negative real autocorrelation (alternating real spend) to 0', () => {
    const spend = [100, 110, 90, 105, 95, 102, 98, 103, 97, 100];
    expect(estimateCarryover(spend)).toBe(0);
  });
});

describe('estimateSaturation', () => {
  it('returns null with fewer than 4 real non-zero weeks', () => {
    expect(estimateSaturation([100, 0, 0])).toBeNull();
  });

  it('matches a real hand-computed gamma from real spend variability', () => {
    const spend = [100, 120, 80, 150, 90, 110, 95, 105];
    expect(estimateSaturation(spend)).toBeCloseTo(0.84, 2);
  });

  it('reads perfectly steady real spend as gamma at the real ceiling of 1', () => {
    const spend = [100, 100, 100, 100, 100];
    expect(estimateSaturation(spend)).toBe(1);
  });

  it('ignores real zero-spend weeks rather than treating them as real low spend', () => {
    const withZeros = estimateSaturation([100, 100, 0, 100, 100, 0, 100]);
    const withoutZeros = estimateSaturation([100, 100, 100, 100, 100]);
    expect(withZeros).toBe(withoutZeros);
  });
});

describe('suggestHyperparameters', () => {
  it('returns one real estimate per real media column, reading each channel\'s own real spend', () => {
    const rows = [
      { date: '2025-01-06', 'TV Cost': 100, 'Meta Cost': 100 },
      { date: '2025-01-13', 'TV Cost': 105, 'Meta Cost': 20 },
      { date: '2025-01-20', 'TV Cost': 110, 'Meta Cost': 180 },
      { date: '2025-01-27', 'TV Cost': 108, 'Meta Cost': 30 },
      { date: '2025-02-03', 'TV Cost': 112, 'Meta Cost': 160 },
    ];
    const result = suggestHyperparameters(rows, ['TV Cost', 'Meta Cost']);
    expect(result.map((r) => r.channel)).toEqual(['TV Cost', 'Meta Cost']);
    expect(result[0].carryover).not.toBeNull();
    expect(result[1].carryover).not.toBeNull();
  });
});
