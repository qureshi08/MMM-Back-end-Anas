import { trainingStepFor } from './training-step-labels';
import { ModelType } from '../entities/dataset.entity';

describe('trainingStepFor', () => {
  it('maps every real Meridian checkpoint to its own step number, in order (7 real steps)', () => {
    expect(trainingStepFor(0.1, ModelType.MERIDIAN)).toEqual({
      stepNumber: 1,
      totalSteps: 7,
      stepLabel: 'Validating your data',
    });
    expect(trainingStepFor(0.3, ModelType.MERIDIAN)).toEqual({
      stepNumber: 3,
      totalSteps: 7,
      stepLabel: 'Building the model configuration',
    });
    expect(trainingStepFor(0.7, ModelType.MERIDIAN)).toEqual({
      stepNumber: 4,
      totalSteps: 7,
      stepLabel: 'Training the model',
    });
    expect(trainingStepFor(1.0, ModelType.MERIDIAN)).toEqual({
      stepNumber: 7,
      totalSteps: 7,
      stepLabel: 'Finalizing results',
    });
  });

  it('maps every real PyMC checkpoint to its own step number, in order (5 real steps, not 7)', () => {
    expect(trainingStepFor(0.1, ModelType.PYMC)).toEqual({
      stepNumber: 1,
      totalSteps: 5,
      stepLabel: 'Validating your data',
    });
    expect(trainingStepFor(0.7, ModelType.PYMC)).toEqual({
      stepNumber: 3,
      totalSteps: 5,
      stepLabel: 'Training the model',
    });
    expect(trainingStepFor(1.0, ModelType.PYMC)).toEqual({
      stepNumber: 5,
      totalSteps: 5,
      stepLabel: 'Finalizing results',
    });
  });

  it('returns null for 0 - not started yet, no real step to show', () => {
    expect(trainingStepFor(0, ModelType.MERIDIAN)).toBeNull();
    expect(trainingStepFor(0, ModelType.PYMC)).toBeNull();
  });

  it('falls back to the last real checkpoint reached for any in-between value, never guessing forward', () => {
    // 0.5 never gets reported by either real pipeline, but if it ever did, the honest answer for
    // Meridian is "still on step 3" (0.3 was its last real checkpoint), not step 4 — and for PyMC,
    // "still on step 2" (0.2 was its last real checkpoint, PyMC has no 0.3 checkpoint at all).
    expect(trainingStepFor(0.5, ModelType.MERIDIAN)).toEqual({
      stepNumber: 3,
      totalSteps: 7,
      stepLabel: 'Building the model configuration',
    });
    expect(trainingStepFor(0.5, ModelType.PYMC)).toEqual({
      stepNumber: 2,
      totalSteps: 5,
      stepLabel: 'Checking data quality',
    });
  });
});
