# Prompt for Amna's Claude — Calibrate skip loops back to itself instead of advancing

Copy everything below into Amna's Claude Code session. Real bug, reproduced live just now.

## What happens

1. On the Calibrate screen (step 4 of 5), leave "Model Calibration" toggled off.
2. Click "Save and continue."
3. Network tab confirms `PATCH .../calibration` really fires and returns **200** — this part
   works now (the earlier `/calibrate` vs `/calibration` route mismatch is fixed).
4. But instead of moving to step 5, the app lands on **Projects**.
5. Opening the model back up shows it stuck at **60% Configuration**, "Continue Setup" drops you
   right back on the exact same Calibrate screen, step 4 of 5 — a loop.

Real dataset row fetched right after this, straight from the API:

```json
{
  "calibration": null,
  "channelHyperparameters": null,
  "columnMapping": { "...": "already saved" },
  "dateRange": { "...": "already saved" },
  "channelCombinations": [{ "newColumnName": "tv_radio_combined", "sourceColumns": ["tv_spend", "radio_spend"] }],
  "exposureDirections": [{ "column": "holiday", "direction": "helps" }, { "column": "competitor_spend", "direction": "hurts" }]
}
```

The save genuinely worked. `calibration: null` **is** the correct, saved state for "the user chose
to skip this" — that's not a partial or broken save, Configure/Optimize/exposure/combinations are
all still there right alongside it.

## Real root cause

Whatever decides "is the Calibrate step done" is almost certainly checking for a truthy
`dataset.calibration`, something like:

```js
const calibrateDone = Boolean(dataset.calibration);
```

That's wrong now. `null` is a real, valid, *completed* state for this step — Hammad's contract
(2026-09-08) made Calibrate genuinely optional, and skipping it is not different from filling it
in as far as "is this step done" should be concerned. The check needs to track **whether the user
has been through this step and saved it**, not whether the object it saved is non-null.

Concretely: track completion off something that's true either way after a real save — a boolean the
step-save call sets locally, or a `hasReachedStep` flag independent of the actual field contents —
not `!!dataset.calibration`.

**Almost certainly the same bug exists on Hyperparameterization.** Same shape: `channelHyperparameters: null`
above is just as valid a "done, skipped" state, and if that step's completion check also does
`Boolean(dataset.channelHyperparameters)`, it will loop exactly the same way. Please check and fix
both in the same pass.

## How to verify the fix

Toggle Calibration off, save, and confirm it actually lands on step 5 (or wherever comes next) —
not Projects. Reopen the model from scratch afterward and confirm it does NOT drop you back on
Calibrate; it should show the step already passed, or take you straight to wherever you left off
past it.
