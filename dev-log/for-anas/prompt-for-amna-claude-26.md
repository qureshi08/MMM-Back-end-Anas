# Prompt for Amna's Claude — real backend for Exposure Metrics

Copy everything below into Amna's Claude Code session. Same real gap as Channel Health had —
Exposure Metrics (the Helps/Hurts/Not sure screen) had nothing behind it.

## 1. Real suggestions — new endpoint

**`GET /datasets/:id/exposure-metrics`** — requires Configure to already be saved.

Response:
```json
{
  "metrics": [
    { "column": "Dates_School_Holidays", "correlation": 0.42, "suggestedDirection": "helps" },
    { "column": "Competitors Promotion", "correlation": -0.31, "suggestedDirection": "hurts" }
  ]
}
```

`suggestedDirection` is one of `"helps"`, `"hurts"`, `"not_sure"` — already computed from a real
correlation against the target column, `"not_sure"` when the real correlation is weaker than 0.1
in either direction. Use `suggestedDirection` directly for the pre-selected pill; `correlation` is
there if you want to show the actual strength somewhere, entirely optional.

Covers every real control **and** organic column from Configure, not just control — call it once
and render both groups from the same response if your screen shows them together.

## 2. Real save — new endpoint

**`PATCH /datasets/:id/exposure-directions`** — call this on "Save and continue."

Request:
```json
{
  "directions": [
    { "column": "Dates_School_Holidays", "direction": "helps" },
    { "column": "Competitors Promotion", "direction": "hurts" }
  ]
}
```

Must include **every** real control + organic column, exactly once each — same "exactly these, no
more no fewer" rule Hyperparameterization already enforces for media channels. `direction` is
`"helps"`, `"hurts"`, or `"not_sure"`. "Accept all suggestions" and "Set ALL to Not sure" are both
just building this same array client-side before calling it — no separate endpoint for either.

## One real thing this does NOT do yet

Saving a direction does **not** currently change a real training run's outcome — it's stored, but
not yet wired into the real job sent to the model engine. That's a separate, real open question for
Hammad (does his engine actually support a sign-constrained prior per control column, and in what
shape) before it can honestly do more than record the user's choice. Don't imply on the screen that
this changes the model's behavior yet — "Not sure is a safe default" framing already in your copy is
accurate; just don't add anything stronger than that for the other two options either, for now.
