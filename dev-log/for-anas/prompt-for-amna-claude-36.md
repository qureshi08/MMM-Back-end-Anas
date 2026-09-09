# Prompt for Amna's Claude — one leftover Calibration mention for PyMC

Copy everything below into Amna's Claude Code session. Real, specific leftover from prompt-35's fix.

## What's wrong

The routing fix from prompt-35 works — a PyMC dataset correctly skips straight from Optimize to
Hyperparameterization, no Calibrate screen anywhere in the flow. Confirmed live.

But the modal that appears after saving Optimize ("Your training range is saved. What's next?")
still says:

> Calibration and Hyperparameters are both optional — this model can go straight to Ready without
> touching either one.

That's stale copy left over from before the PyMC fix. Calibration isn't an option for this dataset
at all anymore, so naming it here contradicts the rest of the flow.

## Exact fix

For a PyMC dataset, that modal's text should read:

> Hyperparameters are optional — this model can go straight to Ready without touching it.

Same rule as everywhere else in this fix: if it isn't required and isn't usable for this engine, it
isn't mentioned. Check the "Set them myself" card's body text and the "Skip for now" card's body text
too — both currently say "Calibration and Hyperparameters" and need the same edit for PyMC datasets.
Meridian datasets keep the current copy unchanged.
