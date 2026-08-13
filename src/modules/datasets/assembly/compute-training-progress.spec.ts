import { computeTrainingProgress, MOCK_TRAINING_DURATION_SECONDS } from './compute-training-progress';

describe('computeTrainingProgress', () => {
  it('reports running with partial progress partway through the mock window', () => {
    const startedAt = new Date('2026-08-12T10:00:00.000Z');
    const now = new Date(startedAt.getTime() + (MOCK_TRAINING_DURATION_SECONDS / 2) * 1000);
    const result = computeTrainingProgress(startedAt, now);
    expect(result.status).toBe('running');
    expect(result.progress).toBeCloseTo(0.5, 1);
  });

  it('reports completed once the mock window has fully elapsed', () => {
    const startedAt = new Date('2026-08-12T10:00:00.000Z');
    const now = new Date(startedAt.getTime() + (MOCK_TRAINING_DURATION_SECONDS + 5) * 1000);
    const result = computeTrainingProgress(startedAt, now);
    expect(result.status).toBe('completed');
    expect(result.progress).toBe(1);
  });

  it('reports running with 0 progress at the exact start', () => {
    const startedAt = new Date('2026-08-12T10:00:00.000Z');
    const result = computeTrainingProgress(startedAt, startedAt);
    expect(result.status).toBe('running');
    expect(result.progress).toBe(0);
  });
});
