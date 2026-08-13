/**
 * No background job, no queue, this is a mock. Status is computed fresh on every GET from how much
 * time has passed since POST /train was called, so the frontend gets a real-feeling "running then
 * completed" transition without any actual worker behind it.
 */
export const MOCK_TRAINING_DURATION_SECONDS = 8;

export function computeTrainingProgress(
  startedAt: Date,
  now: Date,
): { status: 'running' | 'completed'; progress: number } {
  const elapsedSeconds = (now.getTime() - startedAt.getTime()) / 1000;
  if (elapsedSeconds >= MOCK_TRAINING_DURATION_SECONDS) {
    return { status: 'completed', progress: 1 };
  }
  return { status: 'running', progress: Math.min(0.95, elapsedSeconds / MOCK_TRAINING_DURATION_SECONDS) };
}
