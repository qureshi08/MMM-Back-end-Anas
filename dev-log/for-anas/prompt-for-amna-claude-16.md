# Prompt for Amna's Claude — the "Train Model" button doesn't actually exist

Copy everything below into Amna's Claude Code session, in her frontend repo. This is a real bug
found today, confirmed against the live backend, not a guess.

## The bug

Once a dataset hits 100% Configuration, the models list page shows a green **"Training… 0%"**
pill next to it. It looks like a live status. It isn't — it's not wired to anything real, and
there is no actual "Train Model" button anywhere for the user to click.

Confirmed with real evidence, not assumed:

- `GET /datasets/:id/status` for that dataset returns:
  ```json
  { "status": "not_started", "progress": 0, "jobId": null }
  ```
- The full Network tab was checked end to end. **`POST /datasets/:id/train` is never called** —
  not on page load, not after clicking the pill, not ever. There is no code path today that
  actually starts a real training run from this page.

So the pill is lying: it always shows "Training… 0%" for a dataset that's fully configured, no
matter how many times it's clicked, forever, because nothing behind it ever changes.

## What's needed

Replace the fake pill with a **real** button, driven by the dataset's actual
`training_status` (from `GET /datasets/:id` or `GET /datasets/:id/status`):

| `training_status` | What to show |
|---|---|
| `not_started` | A real, clickable **"Train Model"** button. On click, `POST /datasets/:id/train` (no body needed), then start polling status. |
| `running` | **"Training… X%"**, using the real `progress` value from `GET /datasets/:id/status` — not a hardcoded 0. |
| `completed` | **"View Model"** (this part already works correctly — "2nd test" shows it fine). |
| `failed` | A real error state, showing `errorMessage` from the status response if present. |

`POST /datasets/:id/train` returns the updated dataset immediately (`trainingStatus: "running"`,
a real `jobId`). Poll `GET /datasets/:id/status` every few seconds while `status` is `running` to
update the percentage, same pattern the model detail page likely already uses elsewhere for
Optimize/Assemble — reuse that if it exists rather than building a second poller.

One more real edge case, already handled on the backend: if training is already running for a
dataset, `POST /datasets/:id/train` returns a `400` with the message "Training is already running
for this dataset. Wait for it to finish before starting another run." — show that message as-is
rather than a generic error.
