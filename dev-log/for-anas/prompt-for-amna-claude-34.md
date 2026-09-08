# Prompt for Amna's Claude — real Automatic Optimization, replacing the random draw

Copy everything below into Amna's Claude Code session. Real feature, not a tweak — Anas flagged the
random-draw behavior live during testing as no longer acceptable now that real training is connected.

## New real endpoint

```
GET /datasets/:id/suggested-hyperparameters
```

Returns:

```json
{
  "suggestions": [
    { "channel": "google_ads_spend", "carryover": 0.62, "saturation": 0.91 },
    { "channel": "instagram_spend", "carryover": null, "saturation": 0.74 }
  ]
}
```

One entry per real media column from Configure. `carryover` and/or `saturation` come back `null`
when that channel doesn't have enough real weeks of spend (fewer than 4) to compute a real signal
— treat `null` the same as "no suggestion available for this field," don't fall back to a random
guess for it.

Requires Configure saved first (`400` otherwise, same pattern as every other assembly endpoint).
Uses Optimize's real date range when it's been saved, and real channel combinations when set — so
the suggestion reflects the real weeks and real combined channels that will actually train, not
the raw uploaded file.

## What's changing conceptually

The old behavior picked a value with pure client-side randomness (`current ± variance%`) — it
never looked at the dataset at all. Now:

- **AdStock's "Automatic Optimization"** should call this endpoint and use the returned `carryover`
  for that channel, instead of a local random draw.
- **Diminishing Returns' "Automatic Optimization"** should use the returned `saturation` for that
  channel's **Gamma** slider (not Alpha — Alpha stays local-only/illustrative, unchanged). Same as
  before.
- If a suggestion comes back `null` for a field, either disable that field's Automatic Optimization
  for that channel with a real reason ("not enough spend history to estimate"), or fall back to
  the current slider value unchanged — don't silently substitute a random number instead.
- The **"Estimated"** badge and its behavior (clears on manual edit/Apply) stay exactly the same —
  this is still a real heuristic, not Meridian's own trained answer, so the honest "Estimated"
  labeling is still correct and still needed. Only the *source* of the number changed, from random
  to real.

## One real number, cached or fresh?

Since this now depends on real data (spend history, date range, combinations), it's a genuine
`GET` — feel free to call it once when the Hyperparameterization screen loads and cache the
suggestions client-side per channel, calling Automatic Optimization just re-applies the same
already-fetched real number rather than re-fetching every click. Your call on the exact caching
approach; the endpoint itself is cheap to call as often as needed either way.
