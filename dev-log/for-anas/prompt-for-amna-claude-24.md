# Prompt for Amna's Claude — real second engine, PyMC-Marketing

Copy everything below into Amna's Claude Code session. Hammad handed over a second real modeling
engine today — the backend already supports it, this is the frontend half.

## What changed

`modelType` on `POST /projects/:projectId/datasets` now accepts a real second value: `"pymc"`,
alongside the existing `"meridian"`. This is the same field the create-dataset form already sends
(it's always been a real, validated field — `meridian` just used to be the only real choice).

**Show a real dropdown/toggle for this on the create-dataset screen** — "Meridian" vs
"PyMC-Marketing" — instead of whatever currently hardcodes or defaults it to `meridian`. Whatever
the user picks gets sent as `modelType` in the create request, unchanged from today's contract.

## Nothing else needs to change

Every other endpoint — Configure, Optimize, Calibrate, Hyperparameterization, Train Model, status
polling, results — works exactly the same regardless of which engine a dataset uses. The backend
routes to the right real engine internally based on the dataset's own `modelType`, invisibly to
the frontend. Results come back in the identical shape either way (`data_used`,
`model_confidence`, `channel_contribution`, `channel_efficiency`, `data_quality_flags`,
`budget_recommendation`, `saturation_status`, `adstock_decay_curves`, `saturation_curves`).

**One real, known gap for now:** PyMC's pipeline doesn't yet produce the 3 "story" fields
(`actual_vs_predicted`, `channel_confidence`, `baseline_vs_marketing`) that Meridian results have
— those stay optional in the contract for exactly this reason, so check for their presence before
rendering that part of the results page, same as already specified in prompt-20. A PyMC-trained
dataset's results page will show everything except those 3 sections until that gap is closed on
the model side.

## Step progress differs slightly between engines

Already handled on the backend — `GET /status` returns the correct `totalSteps` for whichever
engine the dataset actually uses (Meridian: 7 real steps, PyMC: 5). If the step-progress display
you built from prompt-22 already reads `totalSteps` from the response rather than hardcoding "7,"
nothing changes for you here. If it's hardcoded to 7 anywhere, fix that now — a PyMC run reaching
"Step 5 of 5" should show as done, not stuck at "5 of 7."
