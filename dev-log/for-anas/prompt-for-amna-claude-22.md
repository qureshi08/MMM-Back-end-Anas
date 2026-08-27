# Prompt for Amna's Claude — show real training steps, not a raw percentage

Copy everything below into Amna's Claude Code session. Real change from Anas today: the raw
".3%"-style progress number is confusing, it should read as a real step.

## What changed

`GET /datasets/:id/status` now includes 3 new fields alongside the existing `progress`:

```json
{
  "status": "running",
  "progress": 0.3,
  "jobId": "...",
  "stepNumber": 3,
  "totalSteps": 7,
  "stepLabel": "Building the model configuration"
}
```

`stepNumber`/`totalSteps`/`stepLabel` are the 7 real, fixed steps the actual training pipeline
goes through, in order:

1. Validating your data
2. Checking data quality
3. Building the model configuration
4. Training the model
5. Calculating budget recommendations
6. Computing decay and saturation curves
7. Finalizing results

## What to change

Replace whatever currently shows the raw `progress` value as a percentage (the source of the
confusing ".3%" you saw) with **"Step {stepNumber} of {totalSteps}: {stepLabel}"** — e.g. "Step 3
of 7: Building the model configuration". `progress` is still there if you want a secondary visual
(like a segmented progress bar with 7 ticks instead of a smooth 0-100% bar, since it only ever
jumps between these 7 exact values, never continuously), but the step text is what should read
clearly.

`stepNumber`/`totalSteps`/`stepLabel` are optional — they're absent when `status` is
`"not_started"` (nothing to show yet) or during a rare transient network hiccup reaching the
engine (keep polling normally in that case, don't show an error).
