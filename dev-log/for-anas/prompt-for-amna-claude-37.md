# Prompt for Amna's Claude — OTP attempt limit doesn't seem to apply, no attempts-left indicator

Copy everything below into Amna's Claude Code session. Two real issues on the "Check your email"
verification screen, found live.

## Issue 1: the real 5-attempt limit doesn't seem to be enforced

Backend confirmed, code unchanged since it was first built: `otp.service.ts` blocks after 5 wrong
attempts on the same code, with `"Too many incorrect attempts. Request a new one."` Live testing
just now: entering a wrong code repeatedly never triggered that block, or any visible change at all
beyond the same generic "Incorrect code." message every time.

**Likely real cause, needs checking on your side**: each `OtpCode` row's `attempts` counter only
increments while that *same* code is still the active one. If anything in the frontend calls
"request a new code" somewhere other than an explicit Resend click &mdash; a re-render, a page
reload while on this screen, a background refetch &mdash; a fresh code row gets created with
`attempts: 0`, and every wrong guess after that starts counting from zero again on the new code.
That would make the real 5-try limit effectively unreachable, without the backend logic itself
being wrong.

Please check exactly when your code calls the request-code endpoint. It should fire **only** on:
first arriving at this screen, and an explicit "Resend code" click &mdash; never automatically on a
re-render, remount, or reload while already on this screen.

## Issue 2: no indication of the limit at all, anywhere on screen

Right now nothing on the "Check your email" screen tells the user a limit exists, how many tries
are left, or when the code expires. A wrong guess just says "Incorrect code." with no context.

**Done on our side**: `POST /otp/verify` now returns a real `attemptsRemaining` number in its error
body on every failed attempt (`401`), both for a wrong code and for hitting the 5-try limit:

```json
{ "message": "Incorrect code.", "attemptsRemaining": 3 }
```

```json
{ "message": "Too many incorrect attempts. Request a new one.", "attemptsRemaining": 0 }
```

**What's needed on your side**: read that real field and show it &mdash; "Incorrect code. 3 attempts
left." instead of just "Incorrect code." When `attemptsRemaining` is `0`, disable Verify and point
the user at Resend code instead of letting them keep guessing against a code that's already dead.

Consider a visible countdown or "expires in Xm" note too, since a real 10-minute window with no
visual cue just means the user finds out it expired the hard way.
