# Prompt for Amna's Claude — real root cause found, plus a new resend cooldown

Copy everything below into Amna's Claude Code session. Both fixed on our side, one needs your input.

## The real root cause of "attemptsRemaining stuck at 4"

Not a frontend bug, not a stale deploy. Every authenticated request runs inside one database
transaction, and it used to roll back on *any* thrown error — including a completely normal
"Incorrect code." rejection. That rollback was undoing the real attempts-counter write right along
with it, every single time. Confirmed live and fixed (`TenantContextInterceptor`, commit
`eabfea5`). Re-tested live just now: the count genuinely goes 4 → 3 → 2 → 1 → 0, then blocks. Your
frontend code for reading `attemptsRemaining` and disabling Verify at 0 was correct the whole time.

## New: a real 30-second cooldown on requesting a new code

Anas found the next real gap live: nothing stopped spamming "Resend code" &mdash; each click got a
fresh 5-try budget and sent another real email, with no limit. `POST /auth/otp/request` now enforces
a real 30-second cooldown per account, checked against the most recently sent code whether it was
used or not. Blocked requests come back as a `400` with:

```json
{ "message": "Please wait 22s before requesting another code.", "retryAfterSeconds": 22 }
```

**What's needed on your side**: read `retryAfterSeconds` from that `400` body and show it &mdash;
disable "Resend code" for that many real seconds, ideally with a visible countdown, rather than
letting the click just silently fail or show a generic error. Same honesty pattern as the
attempts-left text: show the real number, not a vague "try again later."
