import { ModelType } from '../entities/dataset.entity';

/**
 * Real training pipeline steps, 2026-08-24 — Anas: raw progress like ".3%" doesn't mean anything
 * to a user, it should read "Step 3 of 7." The 7 checkpoints below are the real, exact
 * `report_progress(...)` calls in `run_meridian_pipeline.py` (verified against that file, not
 * guessed) — each one fires once, in this order, as the real pipeline moves through Colab. A
 * fraction polled mid-run is always exactly one of these 7 values, never something in between,
 * since nothing reports progress more finely than this within a step.
 */
const MERIDIAN_STEPS: Array<{ progress: number; label: string }> = [
  { progress: 0.1, label: 'Validating your data' },
  { progress: 0.2, label: 'Checking data quality' },
  { progress: 0.3, label: 'Building the model configuration' },
  { progress: 0.7, label: 'Training the model' },
  { progress: 0.8, label: 'Calculating budget recommendations' },
  { progress: 0.9, label: 'Computing decay and saturation curves' },
  { progress: 1.0, label: 'Finalizing results' },
];

/**
 * PyMC-Marketing's real checkpoints, added 2026-08-27 (Hammad's second engine) — verified against
 * the real `report_progress(...)` calls in `pymc_run_pipeline.py`. Only 5 real steps, not 7 — no
 * separate "building configuration" checkpoint (folded into training itself) and no separate
 * "computing curves" checkpoint (folded into the one results-extraction step).
 */
const PYMC_STEPS: Array<{ progress: number; label: string }> = [
  { progress: 0.1, label: 'Validating your data' },
  { progress: 0.2, label: 'Checking data quality' },
  { progress: 0.7, label: 'Training the model' },
  { progress: 0.9, label: 'Extracting results' },
  { progress: 1.0, label: 'Finalizing results' },
];

function stepsFor(modelType: ModelType): Array<{ progress: number; label: string }> {
  return modelType === ModelType.PYMC ? PYMC_STEPS : MERIDIAN_STEPS;
}

/**
 * Maps a raw progress fraction to the real step it corresponds to, for the given engine — the
 * last checkpoint reached at or before the given value, since that's the most recent real fact
 * the number represents. Returns null for 0 (not started yet, no step to show) or anything past
 * 1.0.
 */
export function trainingStepFor(
  progress: number,
  modelType: ModelType,
): { stepNumber: number; totalSteps: number; stepLabel: string } | null {
  const steps = stepsFor(modelType);
  let reached: { progress: number; label: string } | null = null;
  let stepNumber = 0;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].progress <= progress) {
      reached = steps[i];
      stepNumber = i + 1;
    }
  }
  if (!reached) return null;
  return { stepNumber, totalSteps: steps.length, stepLabel: reached.label };
}
