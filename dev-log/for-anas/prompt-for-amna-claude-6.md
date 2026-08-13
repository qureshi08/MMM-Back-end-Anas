# Prompt for Amna's Claude — Train Model is real now (mock, real shape)

Copy everything below into Amna's Claude Code session, in her frontend repo (`mmm-frontend-amna`).
Follows `prompt-for-amna-claude-5.md`. Real training against the modeling team's worker is staying
on hold for now (a decision, not a delay), so instead of leaving `Train Model` disabled with a
"Coming soon" label, it's wired to a real backend endpoint that runs a mock training pass and
returns simulated results in the exact shape a real trained model would.

## The three real endpoints

### `POST /datasets/:id/train`

Call this when the user clicks `Train Model`. No request body. Real dataset id in the URL, same
auth as everything else. Requires Configure, Optimize, Calibrate and Hyperparameterization all
already saved (it'll 400 naming exactly what's missing if not, same as `/assemble` already does).

Response, `200`:
```json
{ "id": "...", "trainingStatus": "running", "trainingStartedAt": "2026-08-12T10:00:00.000Z", "jobId": "...", "...": "the rest of the dataset row" }
```

### `GET /datasets/:id/status`

Poll this after calling `/train`. Real dataset id in the URL.

```json
{ "status": "running", "progress": 0.42, "jobId": "..." }
```

`status` is `"running"` for about 8 seconds after `/train` was called, then `"completed"`. No real
background job, it's computed fresh from elapsed time on every call — poll it every second or two,
show a progress bar or spinner using the real `progress` value (0 to 1).

### `GET /datasets/:id/results`

Call once `status` is `"completed"`. `400` if training hasn't started or is still running.

## The real result shape — build the results screen against this exactly

```json
{
  "data_used": { "date_column": "Date", "target_column": "Accounts Subscriptions", "media_columns": [...], "control_columns": [...], "organic_columns": [], "geo_columns": [], "first_date": "2025-01-06", "last_date": "2025-04-21", "row_count": 16 },
  "model_confidence": { "overall_accuracy_percent": 89.4, "overall_accuracy_formula": "100% minus the average prediction error (MAPE)", "average_error_percent": 10.5, "weighted_average_error_percent": 10.4, "r_squared": 0.68, "adjusted_r_squared": 0.66 },
  "channel_contribution": [ { "channel": "TV", "spend": 25400, "pct_of_spend": 22.6, "incremental_outcome": 21590, "pct_of_contribution": 0.31 } ],
  "channel_efficiency": [ { "channel": "TV", "roi": 0.85, "marginal_roi": 0.29, "effectiveness": 0.85, "cost_per_incremental_result": 93.4 } ],
  "data_quality_flags": [ { "message": "These are simulated results for demo purposes...", "columns_involved": [] } ],
  "budget_recommendation": [ { "channel": "TV", "current_spend": 25400, "current_pct_of_budget": 22.6, "optimized_spend": 19800, "optimized_pct_of_budget": 17.6, "spend_change_dollars": -5600, "spend_change_percent": -22, "current_roi": 0.85, "optimized_roi": 0.98 } ],
  "saturation_status": [ { "channel": "TV", "carryover_label": "long", "saturation_label": "moderately" } ],
  "adstock_decay_curves": [ { "channel": "TV", "curve": [ { "weeks_since_spend": 0, "effect_remaining_percent": 100 }, { "weeks_since_spend": 1, "effect_remaining_percent": 30 } ] } ],
  "saturation_curves": [ { "channel": "TV", "curve": [ { "spend_level": 0, "effect": 0 }, { "spend_level": 6350, "effect": 0.42 } ], "historical_spend_distribution": [ { "spend_range_start": 0, "spend_range_end": 3200, "relative_frequency_percent": 25 } ] } ],
  "status": "completed",
  "mock": true
}
```

Note: `channel` names here are shortened (`"TV"`, `"Google Display"`), stripped of a trailing
" Cost" from the column name Configure collected — that's intentional, matches the real modeling
team's own output format.

## What to build

1. Wire `Train Model` (currently disabled everywhere it appears — the models list and the model's
   own "Setup complete" screen) to call `POST /datasets/:id/train`, then poll `/status` every
   1-2 seconds, showing a real progress indicator (Cassandra's "Optimizing Your Model..." modal is a
   fine reference for the feel, doesn't need to match exactly).
2. Once `status` is `"completed"`, navigate to a real results screen calling `GET /datasets/:id/results`
   and show, at minimum: `model_confidence` as a few real stat numbers, `channel_contribution` and
   `channel_efficiency` as a real table or chart per channel, `budget_recommendation` as a
   current-vs-optimized comparison. `adstock_decay_curves`/`saturation_curves` are real but lower
   priority, a simple line chart per channel if there's time, skip for now if not.
3. **Required, not optional: a visible "Simulated results" banner or label on the results screen**,
   always shown, driven by the real `mock: true` field, not hardcoded — when this eventually flips
   to a real trained model, the banner should disappear on its own without a code change. Don't let
   a user come away thinking they've seen a real trained model's output.
4. The Models list row for a dataset that's `"completed"` should probably change from
   `Train Model [Coming Soon]` to something like `View Results`, leading to the screen from step 2.
