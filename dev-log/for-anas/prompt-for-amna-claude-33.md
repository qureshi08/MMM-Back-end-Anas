# Prompt for Amna's Claude — Calibrate: stale calculation, and evidence corrections not saving

Copy everything below into Amna's Claude Code session. Two real bugs found live, back to back.

## Bug 1: The "Calculated" card shows stale math after correcting a field

1. On a flagged channel's Evidence step, type `18500` in Incremental $.
2. Start typing `102000` in Total $, but the "Calculated" line updates using an incomplete value
   (e.g. reads it after just the first digit `1`, or otherwise before the full number is in) —
   showing `$18,500 ÷ $1 = 100%`.
3. Go back into the Total $ field and correct it to the full `102000`.
4. The input box itself now shows `102000` correctly.
5. **But the "Calculated" / Review card still shows the old, wrong math: `$18,500 ÷ $1 = 100%`.**

The calculation isn't re-running from the field's current value — it's stuck on whatever it first
computed. This needs to recompute live off the actual current field values, not a stale snapshot.

## Bug 2: Correcting evidence and saving doesn't actually save the correction

Same session: after seeing the stale `$1` calculation, clicked through to Save anyway. The real
saved `calibration` on the dataset stayed exactly `{ contributionBeliefPercent: 26,
confidencePercent: 70 }` — unchanged from a previous save, minutes earlier. The correction never
reached the server as a new value. The app then moved forward to Hyperparameterization on its own,
with no clear way back to retry the Calibrate save.

**What's needed:** once Bug 1 is fixed (the review card reflects live, correct field values),
confirm that clicking Save actually sends whatever is currently shown in the review card — not a
value cached from an earlier, incomplete state. Test by: entering evidence, blurring the field,
confirming the Calculated line is correct, then Save, then checking the real dataset response to
confirm the new numbers actually landed (not the previous save's numbers).

## Not a bug, for context

One `calibration` request in the same session returned a real `502` ("Failed to fetch"). That's very
likely a Render free-tier cold start (the backend sleeps after inactivity, first request while it's
waking can 502) — not something to chase in your own code. Retrying it worked fine.
