# Prompt for Amna's Claude — carryoverEstimated/saturationEstimated now exist, wire them in

Copy everything below into Amna's Claude Code session.

## Done on our side

`PATCH /datasets/:id/hyperparameters` now accepts two more optional fields per channel, alongside
`carryover`/`saturation`:

```json
{ "channel": "TV Cost", "carryover": 0.85, "carryoverEstimated": true }
```

- `carryoverEstimated` (boolean, optional)
- `saturationEstimated` (boolean, optional)

Both are stored as-is on the dataset's `channelHyperparameters` and returned back on every
subsequent read (`GET`/`PATCH` response, and anywhere else the dataset object comes back). Neither
one is ever sent to Hammad's real engine — only the actual `carryover`/`saturation` numbers reach
`model_configuration.channels`, confirmed by a real test.

## What to change on your side

When Automatic Optimization sets `carryoverEstimated`/`saturationEstimated` to `true` in your local
state, include that same boolean in the real save request (same call that already sends
`carryover`/`saturation`) instead of only keeping it client-side. On load, read it back from the
dataset response and use it to decide whether to show the "Estimated" badge — instead of the flag
always starting `false`/absent right after a reload.

Same rule as before still applies: the flag should flip back to `false` (and stop being sent as
`true`) the moment a user manually edits that slider or hits Apply on a manual value — a value they
just chose themselves is never "estimated," regardless of what it was before.
