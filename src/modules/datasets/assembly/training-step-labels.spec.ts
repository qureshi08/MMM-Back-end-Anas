import { trainingStepFor, TRAINING_STEPS } from './training-step-labels';

describe('trainingStepFor', () => {
  it('has exactly 7 real steps, matching the real 7 report_progress() calls in run_meridian_pipeline.py', () => {
    expect(TRAINING_STEPS).toHaveLength(7);
  });

  it('maps every real checkpoint to its own step number, in order', () => {
    expect(trainingStepFor(0.1)).toEqual({ stepNumber: 1, totalSteps: 7, stepLabel: 'Validating your data' });
    expect(trainingStepFor(0.3)).toEqual({
      stepNumber: 3,
      totalSteps: 7,
      stepLabel: 'Building the model configuration',
    });
    expect(trainingStepFor(0.7)).toEqual({ stepNumber: 4, totalSteps: 7, stepLabel: 'Training the model' });
    expect(trainingStepFor(1.0)).toEqual({ stepNumber: 7, totalSteps: 7, stepLabel: 'Finalizing results' });
  });

  it('returns null for 0 - not started yet, no real step to show', () => {
    expect(trainingStepFor(0)).toBeNull();
  });

  it('falls back to the last real checkpoint reached for any in-between value, never guessing forward', () => {
    // 0.5 never gets reported by the real pipeline, but if it ever did, the honest answer is
    // "still on step 3" (0.3 was the last real checkpoint), not step 4.
    expect(trainingStepFor(0.5)).toEqual({
      stepNumber: 3,
      totalSteps: 7,
      stepLabel: 'Building the model configuration',
    });
  });
});
