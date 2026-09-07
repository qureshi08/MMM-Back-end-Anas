# Prompt for Amna's Claude — real data quality endpoint + real Channel Health backend

Copy everything below into Amna's Claude Code session. Two real backend gaps found end-to-end
testing a real Meridian run today, both now fixed on the backend — this is the frontend half of
each.

## 1. Real upfront data quality check — new endpoint

**`GET /datasets/:id/data-quality`** — call this right after Upload Data finishes (before Configure
is even saved), and also after Configure is saved if the user changes the file's column mapping.

Response:
```json
{ "flags": [{ "severity": "error", "message": "...", "columnsInvolved": ["date"] }] }
```

Real bug this replaces: a bad date format, blank cells, or negative spend used to only surface at
Train Model, after every other step was already filled in, because Hammad's engine was the only
thing checking. Now the same real checks run the moment a file is uploaded — show `error` flags as
a real blocker (don't let the user continue past Configure with one still showing) and `warning`
flags as a dismissible real notice, not a hard stop.

This runs against the *suggested* column mapping if Configure hasn't been saved yet, and the real
saved one afterward — you don't need to wait for Configure to call it.

## 2. Real Channel Health — new endpoint, replaces whatever is powering that screen today

**`GET /datasets/:id/channel-health`** — requires Configure to already be saved (400s with a clear
message otherwise, same pattern as every other per-dataset endpoint).

Response:
```json
{
  "channels": [
    {
      "channel": "newspaper_spend",
      "shareOfSpendPercent": 1.2,
      "vif": 1.1,
      "mostCorrelatedWith": "instagram_spend",
      "mostCorrelatedValue": 0.34
    }
  ]
}
```

- `vif` can be `null` — either there's only one real media column (nothing to compare against) or
  the regression genuinely has no unique answer (two *other* channels are themselves exactly
  collinear). Show "not enough data to tell" rather than treating null as zero.
- `mostCorrelatedWith`/`mostCorrelatedValue` can also be `null` for the same "only one channel"
  case.

**The spend-cutoff and VIF-cutoff sliders stay entirely client-side.** The backend deliberately
returns raw numbers, not a fixed flag, so dragging a slider re-flags instantly without a network
round-trip — compute "Both issues" / "One issue" / "Healthy" per channel yourself, from
`shareOfSpendPercent < spendCutoff` and `vif > vifCutoff`, exactly matching the real chart you
already built.

**"Combine with X →"** on the per-channel panel: use `mostCorrelatedWith` directly — that's already
the single real channel this one correlates with most strongly, computed from the actual uploaded
data. No separate call needed for that suggestion.

## Not done yet, don't build against it

Exposure Metrics (the Helps/Hurts/Not sure screen for control columns) still has no real backend —
that's next, a separate prompt will follow once it exists. Leave that screen as-is for now.
