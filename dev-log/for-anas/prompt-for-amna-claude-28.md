# Prompt for Amna's Claude — Calibrate & Hyperparameterization are now genuinely optional

Copy everything below into Amna's Claude Code session. Matches Hammad's real contract for these
two steps — both endpoints changed behavior, not just validation messages.

## Calibrate: `PATCH /datasets/:id/calibrate`

Both fields are now optional, but only together:

```json
{ "contributionBeliefPercent": 30, "confidencePercent": 80 }
```

or

```json
{}
```

Sending just one (`{ "contributionBeliefPercent": 30 }` with no `confidencePercent`) now returns a
real `400`:

```json
{ "message": "Provide both contributionBeliefPercent and confidencePercent together, or leave both out — not just one." }
```

**Frontend change needed:** if the Calibrate screen has two fields, the Save action must be blocked
(or both fields cleared together) when only one is filled in. Leaving both blank and saving is a
real, valid, supported action now — it means "no belief input," not an error state.

## Hyperparameterization: `PATCH /datasets/:id/hyperparameterize`

`channels` no longer has to cover every real media column. Any of these are valid:

```json
{ "channels": [] }
```

```json
{ "channels": [ { "channel": "TV Cost", "carryover": 0.85 } ] }
```

```json
{ "channels": [
  { "channel": "TV Cost", "carryover": 0.85, "saturation": 1.5 },
  { "channel": "Meta Cost", "saturation": 1.1 }
] }
```

Real rules:
- A channel can have `carryover` only, `saturation` only, or both.
- A channel with **neither** field set is rejected — leave it out of the list instead of sending
  `{ "channel": "TV Cost" }` with nothing else.
- `saturation` must be strictly greater than 0 now (was `>= 0` before).
- A channel name that isn't one of this dataset's real media columns from Configure is still
  rejected, same as before.

**Frontend change needed:** only send an entry for a channel the user actually touched. Don't send
every media column with default/placeholder values just to "fill the array" — an untouched channel
should not appear in `channels` at all.

## Assemble no longer requires either step

`POST /datasets/:id/assemble` used to block with "Save these steps first: Calibrate,
Hyperparameterization" if either was skipped. That block is gone — Hammad's engine applies its own
real defaults when a dataset has never been calibrated or hyperparameterized. Configure and Optimize
are still required.

**Frontend change needed:** if the Assemble/Train button was disabled until Calibrate and
Hyperparameterization showed a checkmark, that gating should come off. Those two steps are now
genuinely optional, not "optional but the API still requires it."
