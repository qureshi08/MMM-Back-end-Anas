# Prompt for Amna's Claude — real row data, real column combining, one calibration fix

Copy everything below into Amna's Claude Code session, in her frontend repo (`mmm-frontend-amna`).

## 1. Two new real endpoints, replace the "Example data" placeholders

**`GET /datasets/:id/rows`** — returns `{ rows: [...] }`, one real object per row, exactly as it is
in the uploaded file (numbers come back as real numbers, not strings). Use this for:
- Upload Data's data preview table
- Optimize's timeframe chart, channel correlation table, and spend-share bars

**`POST /datasets/:id/combine-columns`** — body `{ "columns": ["Column A", "Column B"] }`, returns
`{ dateColumn, series: [{ date, value }] }`, a real summed series per date. Use this for "Combine
similar channels" instead of merging numbers client-side. Needs Configure saved first (it needs to
know which column is the date column), same requirement `date-range` already has.

Both are live once this backend deploys, no auth changes, same pattern as every other `datasets`
route.

## 2. Calibrate wizard needs to shrink, not grow

Hammad's real engine only ever accepts **one overall** belief/confidence pair
(`contributionBeliefPercent`, `confidencePercent`) — never per-channel, confirmed directly in his own
code. The backend already only stores that one pair, and always will, this was never a missing
feature to build toward.

Please simplify the Calibrate screen to one belief/confidence input and drop the per-channel Variable
Type / Variable / Metric / Time Period entries, they can't reach the real engine no matter what gets
built behind them. `PATCH /datasets/:id/calibration` already works exactly this way today, nothing to
wait on.

## 3. Automatic hyperparameter optimization — keep it, just label it

No backend change here. Keep the current in-browser random-draw behavior for "Automatic Optimization"
on Hyperparameters, but add a small "Estimated" label near the result, since real training may pick
different values once it's connected for real later. Same honesty rule already used for mock training
results elsewhere on this app.

## 4. Train Model — unchanged

Still mock, still flagged `results.mock === true`. Not part of this round, nothing new to do here.
