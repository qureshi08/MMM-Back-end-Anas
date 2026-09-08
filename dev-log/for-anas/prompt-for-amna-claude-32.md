# Prompt for Amna's Claude — Calibrate save succeeds but "Save and continue" won't advance

Copy everything below into Amna's Claude Code session. Real bug, reproduced live.

## What happens

1. Calibrate toggled on. Two channels are flagged: `newspaper_spend` and `tv_radio_combined`.
2. Real evidence filled in for `newspaper_spend` only (Incremental $18,500 / Total $102,000).
   `tv_radio_combined` left blank — no evidence for it.
3. Click **Save and continue**.
4. Network tab confirms the real `PATCH .../calibration` request fires and returns success.
5. The dataset really is updated: `calibration: { contributionBeliefPercent: 26, confidencePercent: 70 }`
   — a real, valid, fully saved calibration.
6. But the page does not advance to the next step. The sidebar still shows **"1 of 2 flagged
   channels calibrated so far"** with a lock icon next to Save and continue.

## Real root cause (likely)

Whatever gates "Save and continue" is almost certainly checking that every flagged channel has
been calibrated, not just that the real save succeeded. But that's not what the actual contract
requires — Hammad's real API only ever wants one overall `contributionBeliefPercent`/
`confidencePercent` pair, and it's completely valid to derive that pair from evidence on just one
flagged channel (or none at all — Calibrate is optional end to end).

"1 of 2 flagged channels calibrated so far" is fine as an informational note, but it shouldn't be a
requirement to leave the page. A user who has real evidence for one channel and nothing for the
other should be able to save and move on — same as skipping Calibrate entirely, which already
works correctly.

## What's needed

Un-gate "Save and continue" from "every flagged channel calibrated." It should advance once the
real save succeeds (confirmed 200 from `PATCH .../calibration`), same as it already does when
Calibration is toggled off entirely. The "X of Y flagged channels calibrated" line can stay as
informational context, just not a blocker.
