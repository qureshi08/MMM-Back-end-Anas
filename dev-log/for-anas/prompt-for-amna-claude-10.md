# Prompt for Amna's Claude — real date suggestion, plus two old bugs that were never confirmed fixed

Copy everything below into Amna's Claude Code session, in her frontend repo (`mmm-frontend-amna`).
Please actually test each item yourself in the real deployed app before reporting back — same rule
as always, "I made the change" isn't the same as "I confirmed it works."

## 1. New: use the real date-range suggestion on Optimize

`GET /datasets/:id/date-range` is live and tested on the backend. It returns the real min/max date
actually found in the uploaded file:

```json
{ "minDate": "2023-01-02", "maxDate": "2025-12-29" }
```

Call it when the Optimize screen loads (Configure needs to be saved first, the endpoint throws a
clear 400 if it isn't — that's expected, not a bug). Use the result to either pre-fill Start date /
End date with the real range, or show it as a suggestion the user can accept, your call on the exact
UI. The point: nobody should have to guess a date range blind anymore, that's the real gap this
closes.

## 2. Re-check: does "Open Model" work now?

This was flagged before (see `prompt-for-amna-claude-8.md`, item 4) and was never confirmed fixed or
broken since. Click "Open Model" in the project detail popup on the real deployed app. Does it
navigate anywhere? Console error? 404? If it's still broken, same instruction as before: check the
browser console and Network tab first, fix based on the real cause, don't guess.

## 3. Re-check: can you still leave "Edit" without finishing setup?

Also flagged before (`prompt-for-amna-claude-8.md`, item 5), also never confirmed since. Click Edit
on any model, then try to leave (Back to Projects, or the Models list) before finishing every step.
If it still traps you, same rule as before: every screen inside a model's flow must have a working
exit at all times, never gated behind finishing configuration.

## Before reporting back

For all three items, click through it yourself in the real deployed app first, not just in code.
Anas will be re-checking every one of these himself again regardless, and screenshots this time
around are what proved things worked (or didn't) fastest, so a screenshot per item is worth
including in your reply.
