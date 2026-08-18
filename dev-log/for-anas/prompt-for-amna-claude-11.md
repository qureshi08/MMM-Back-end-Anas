# Prompt for Amna's Claude — real Meridian results are live, render them for real

Copy everything below into Amna's Claude Code session, in her frontend repo. The backend now runs
real Meridian training (Hammad's engine, on a Colab GPU) instead of only the mock, when it's
reachable — same three endpoints as before, same shapes, nothing new to call.

## 0. Confirmed broken, with real evidence, not a guess

Anas ran a real job end to end just now. Colab's own log proves it completed for real:
`POST /train 200 OK` → real Meridian sampling (`Sampling from the prior distribution...`,
`Sampling from the posterior distribution (this is the slow step)...`) → `Training complete. Results
saved.` → `GET /results/... 200 OK`. The Models list correctly flipped to "Trained."

But the results panel on the frontend still showed:
- **"Simulated results — not from a real trained model run yet"** — wrong, this run was real.
- **Every field showing `[object Object]`** (`Data_used [object Object]`, `Channel_contribution
  [object Object],[object Object]`, etc.) instead of actual numbers.

Both are exactly items 1 and 2 below — this isn't hypothetical, it's what's live right now.

## 1. The mock/real flag already tells you which one you got

Every result object has `results.mock`, a real boolean, always present:
- `results.mock === true` → simulated, keep whatever "simulated results" banner already exists.
- `results.mock === false` (or absent, treat as false) → a real trained model. Show a small "real
  model results" badge instead of the simulated one, plain text is fine, no icon needed.

**Important**: which one you get is not fixed. It depends on whether the real engine is reachable
at the moment `POST /datasets/:id/train` was called — if it wasn't, you'll get `mock: true`, same as
always. This isn't a bug to report, it's expected: the real engine only runs while a Colab notebook
is open on our side, not a permanently hosted service yet.

## 2. Parse the real result shape (fixes any `[object Object]` labels)

Same shape whether real or mock, so this needs to work correctly either way:
- **Model confidence card**: `results.model_confidence.overall_accuracy_percent`,
  `results.model_confidence.r_squared`.
- **Channel contribution chart**: map the `results.channel_contribution` array
  (`pct_of_contribution`, `incremental_outcome`) into a chart, not a raw object dump.
- **Channel efficiency**: map `results.channel_efficiency` array into an ROI view.
- **Budget recommendation**: map `results.budget_recommendation` into the budget scenario UI.

## 3. Status polling stays exactly as it is

`GET /datasets/:id/status` already works the same way whether the engine is real or mocked — poll it
on an interval while `trainingStatus === 'running'`, switch to `GET /datasets/:id/results` once it
reports `completed`. No new endpoint, no new polling logic needed, this was already built for the
mock and works unchanged for real training.

## 4. Failed training, a real case now

A real training run can genuinely fail (bad data, a Meridian error) in a way the mock never could.
If `GET /datasets/:id/status` ever returns `status: "failed"`, show a clear error state with
whatever `error_message` came back, and a way to go back and re-check Configure/Optimize rather than
a dead end.
