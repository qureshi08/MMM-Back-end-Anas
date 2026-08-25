# Prompt for Amna's Claude — mock results removed entirely, real errors now surface instead

Copy everything below into Amna's Claude Code session. Real policy change from Anas today: "we
will never use mock numbers anywhere, always real now."

## What changed on the backend

`POST /datasets/:id/train`, `GET /datasets/:id/status`, and `GET /datasets/:id/results` used to
silently fall back to fake numbers (or a fake elapsed-time progress bar) whenever the real model
engine was unreachable or misconfigured. That fallback is gone entirely — deleted from the
codebase, not just disabled.

**What this means for the UI:** a real, clear error can now come back from any of these three
endpoints where before it would have silently "succeeded" with fake data. Make sure:

- `POST /train` failing shows the real error message (e.g. "The model engine is not configured,"
  or "Could not reach the model engine to start training: ...") — don't assume it always succeeds.
- `GET /status` can return `{"status": "running", "progress": 0, "errorMessage": "Could not reach
  the model engine just now — still checking, this is not a failure."}` during a real, brief
  network hiccup — this is **not** a failure, keep polling normally, just don't show a scary error
  state for it. Only `status: "failed"` is a real failure.
- `GET /results` failing now means exactly what it says — training isn't done yet, or the engine
  couldn't be reached. Show the real message, same as anywhere else per prompt-19.

## One thing you can safely remove

`results.mock` will never be `true` again — there's no code path left that can produce it.
Any "Simulated results" banner or mock-specific UI branch tied to that flag is now permanently
dead. Not urgent to remove, but safe to delete if you want to simplify.
