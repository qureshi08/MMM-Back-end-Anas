# Prompt for Amna's Claude — two real gaps found during live end-to-end testing

Copy everything below into Amna's Claude Code session. Both Calibrate and Hyperparameterization
work correctly against the real contract now — this is about making them genuinely trustworthy and
durable, not just technically correct.

## 1. Calibrate's saved numbers aren't derivable from what the user sees

Real test just now: calibrated `newspaper_spend` with Incremental $18,500 / Total $102,000. The
wizard showed the math for that one channel — `$18,500 ÷ $102,000 = 18%`, and a "50% → 18%" bar for
it. But the actual saved `calibration` object was `{ contributionBeliefPercent: 34,
confidencePercent: 60 }` — numbers that never appeared anywhere on screen.

I understand *why* they differ — the saved pair is presumably some real aggregate across the whole
model, not just the one channel calibrated, since Hammad's contract only takes one overall pair, not
per-channel. But right now a user has no way to see how their evidence turned into that final 34%/60%.
That's a real trust problem for a feature whose entire purpose is "trust the model more because you
gave it real evidence" — if the number it lands on looks arbitrary, it undermines the whole feature.

**What's needed:** show the real derivation on the Review/Save screen — even just "your evidence on
newspaper_spend (18%) combined with the model's current estimates for every other channel gives an
overall belief of 34%, confidence 60%" (or whatever the real aggregation logic actually does). If
multiple channels get calibrated before saving, show each one's contribution to the final pair.

## 2. Does the "Estimated" flag survive a page reload?

Confirmed: `carryoverEstimated`/`saturationEstimated` exist only in your frontend state — our
backend's `channelHyperparameters` column only ever stores `channel`, `carryover`, `saturation`,
nothing else. (Confirmed by grep — zero references to `estimated` anywhere in the backend.)

**Question:** if a user clicks Automatic Optimization, then reloads the page (or comes back to this
dataset in a later session), does the "Estimated" badge still show, or does the value silently look
like a deliberately chosen number at that point?

If it's local-only and doesn't survive a reload, that's a real gap — a randomly-drawn value should
never look indistinguishable from a real, deliberate choice, no matter when the user looks at it
again, not just in the same browser session. If this matters for how people actually use Setup (do
they always finish the wizard in one sitting, or can they leave and come back?), let me know and
we'll add real `carryoverEstimated`/`saturationEstimated` boolean columns on the backend so it's a
durable fact about the dataset, not transient UI state. Easy addition on our side if needed — just
say the word.
