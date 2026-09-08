# Prompt for Amna's Claude — correction to prompt-32's diagnosis

Copy everything below into Amna's Claude Code session. This corrects the previous bug report
(prompt-for-amna-claude-32.md) — please read this before touching anything for that one, the real
cause looks different from what I guessed.

## What re-testing just showed

Retested with only **1 of 2** flagged channels calibrated (a real, valid evidence value on just
`newspaper_spend`, `tv_radio_combined` left untouched) — and this time **"Save and continue" DID
advance** to Hyperparameterization. So the earlier theory — "it won't advance until every flagged
channel is calibrated" — is probably wrong. Partial calibration is fine and does let you continue.

## What's actually different between the failing and working attempts

The failing attempt (prompt-32) had a real premature-calculation bug feeding into it: typing into
the Total $ field for `tv_radio_combined`, the "Calculated" step read the value after just the
first keystroke (`$1`) instead of waiting for the full number, producing a nonsensical
`$18,500 ÷ $1 = 100%`. That run is the one where Save and continue silently did nothing.

**Real hypothesis now:** the block wasn't about how many channels were calibrated — it was likely
that the `100%` (or whatever came out of the `$1` glitch) calculated belief either failed real
validation somewhere, or genuinely saved but something about acting on a channel whose own
"calculated" value is nonsensical (100% belief from one channel) broke the page's own logic for
deciding it's safe to advance.

## What to actually check

1. Confirm the premature-calculation bug itself first — the Total $ (and Incremental $) fields
   should only calculate once the user finishes typing (on blur, or debounced), never on the first
   keystroke. This is worth fixing regardless of whether it's also the cause of the stuck-page bug.
2. Once that's fixed, re-test the exact original failing scenario: real evidence on just one of two
   flagged channels, Save and continue. If it now advances cleanly, the premature-calculation glitch
   was the real root cause all along, and there's no separate "must calibrate every flagged channel"
   gate to remove — prompt-32 can be treated as resolved by this same fix.
3. If it still gets stuck even with clean, valid single-channel evidence, then there is a real
   separate navigation gate after all, and prompt-32's original ask stands.

Sorry for the wrong diagnosis in prompt-32 — real evidence pointed a different direction on
retest, wanted to correct it before it sent you fixing the wrong thing.
