import { computeExposureMetrics } from './compute-exposure-metrics';

describe('computeExposureMetrics', () => {
  it('suggests "helps" for a real column that moves with the target', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      sales: 1000 + i * 50,
      holiday: i * 2, // rises alongside sales
    }));
    const metrics = computeExposureMetrics(rows, 'sales', ['holiday']);
    expect(metrics[0].suggestedDirection).toBe('helps');
    expect(metrics[0].correlation).toBeGreaterThan(0.1);
  });

  it('suggests "hurts" for a real column that moves against the target', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      sales: 1000 + i * 50,
      competitor_promo: 100 - i * 3, // falls as sales rises
    }));
    const metrics = computeExposureMetrics(rows, 'sales', ['competitor_promo']);
    expect(metrics[0].suggestedDirection).toBe('hurts');
    expect(metrics[0].correlation).toBeLessThan(-0.1);
  });

  it('suggests "not_sure" when the real correlation is too weak to call', () => {
    const rows = [
      { sales: 100, noise: 5 },
      { sales: 105, noise: 5 },
      { sales: 98, noise: 5 },
      { sales: 110, noise: 5 },
    ];
    const metrics = computeExposureMetrics(rows, 'sales', ['noise']);
    expect(metrics[0].suggestedDirection).toBe('not_sure');
  });

  it('computes a real, independent suggestion per column', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      sales: 1000 + i * 50,
      holiday: i * 2,
      competitor_promo: 100 - i * 3,
    }));
    const metrics = computeExposureMetrics(rows, 'sales', ['holiday', 'competitor_promo']);
    expect(metrics.map((m) => m.column)).toEqual(['holiday', 'competitor_promo']);
    expect(metrics.find((m) => m.column === 'holiday')!.suggestedDirection).toBe('helps');
    expect(metrics.find((m) => m.column === 'competitor_promo')!.suggestedDirection).toBe('hurts');
  });
});
