# Prompt for Amna's Claude — Calibration does nothing for PyMC, real gap found

Copy everything below into Amna's Claude Code session.

## Real finding, confirmed by reading PyMC's own code directly

`model_configuration.channels` (Hyperparameterization) works the same for both engines — confirmed,
PyMC's own `pymc_calibrate.py` reads it exactly the same way Meridian does, same per-channel,
per-field optionality.

**Calibration is different: PyMC's real code has zero references to it anywhere.** Meridian uses
`contribution_belief_percent`/`confidence_percent`. PyMC's pipeline (`pymc_run_pipeline.py`,
`pymc_calibrate.py`, `pymc_budget_allocation.py`) never reads either field — confirmed by reading
the source, not assumed. We already fixed the backend so it stops sending `calibration` to PyMC at
all (it only ever went into the payload for Meridian now) — but the frontend still lets a user fill
in Calibration on a PyMC-selected dataset with no indication it's pointless.

## What's needed

When a dataset's model type is PyMC, **hide the Calibrate step entirely.** Not a disabled state, not
a note explaining it does nothing — remove it from the flow for that dataset, the same way a step
that genuinely doesn't apply wouldn't show up at all. Anas's call, explicit: if it isn't usable, it
isn't an option. A visible-but-pointless field with a caveat is worse than not showing it.

Hyperparameterization stays exactly as-is for PyMC — that part is genuinely aligned and usable,
confirmed in PyMC's own code. This is only about Calibrate.

## One more thing worth flagging, not urgent

PyMC's own real code requires `target_budget` and `target_budget_periods` to travel together, or
neither at all — confirmed in `pymc_budget_allocation.py`. Since target_budget isn't collected
anywhere in the app yet (Budget Allocator is planned as a separate feature), this doesn't affect
anything today. Just noting it now so whoever builds Budget Allocator later knows PyMC needs both
fields together, not just one.
