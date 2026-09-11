# Prompt for Amna's Claude — retest shows neither fix actually live yet

Copy everything below into Amna's Claude Code session. Real screenshot, real retest, just now.

## What we saw

On a fresh wrong-code attempt: the countdown shows correctly ("Code expires in 9:39"), but the error
still just says **"Incorrect code."** — no "X attempts left" text anywhere, despite your last report
saying this was done and fully implemented. Continued entering wrong codes past 5 tries: it never
blocked, never showed "Too many incorrect attempts," just kept accepting guesses indefinitely.

## What to check

1. **Confirm your frontend change is actually deployed** (not just committed) — check Vercel's
   deployment log for the commit that added the attempts-left text and the block-at-zero behavior,
   and confirm it's the version currently live, not still building or on a preview branch.
2. **Confirm our backend change is actually deployed too** — our `attemptsRemaining` field went out
   in commit `5519ef3` on the `personal` remote. Hit `POST /otp/verify` with a wrong code yourself
   and check the raw `401` response body for a real `attemptsRemaining` field. If it's missing, our
   backend hasn't redeployed yet on Render's side — flag that back to us, don't build around its
   absence.
3. **Re-confirm the actual root cause of "never blocks."** Your own diagnosis pointed at
   `InteractionType.Redirect` causing a full-page reload mid-flow, resetting the code. Test whether
   a real page reload is genuinely happening during repeated wrong attempts (a visible flash/redraw,
   or `ngOnInit` firing again in your own logs) — since right now it looks like the block never
   triggers even once, not just occasionally.

Once both sides are confirmed actually live, we'll retest for real and report back exactly what we
see, same as every other fix today.
