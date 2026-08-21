# Prompt for Amna's Claude — hide Read-only from write actions, show real backend errors

Copy everything below into Amna's Claude Code session. Two real, related bugs found live during
today's testing call.

## Bug 1: Read-role users can reach create/edit/train/delete controls that always fail

"+ New model" (and the same class of control — new project, Configure/Optimize/Calibrate save,
Train Model, delete project, delete dataset) is shown and clickable for a signed-in user whose
`globalRole` is `read`, even though the backend always rejects these with a real `403`. Confirmed
live: a Read user completed the whole upload wizard up to the final submit before hitting a wall.

**Fix:** hide or disable every create/edit/train/delete control whenever the signed-in user's
`globalRole` is `read`. The role is already available from `GET /members` (your own row) or
wherever you're already reading it for the Members table's ROLE column, which is working now.
Read users should only ever see view-only actions.

## Bug 2: Real backend error messages get swallowed by generic or stale fallback text

Two confirmed live examples of the same root problem:

1. A Read user's blocked dataset upload showed **"Using local data for now — real upload isn't
   fully live yet (storage isn't configured on the backend)..."** — a stale message from before
   real upload was wired up (storage has been live for days). The real reason was a `403` with
   the message `"Your role only allows viewing. Ask a Master for Read/Write access."`
2. Settings → Members showed a generic **"Internal server error"** for what was actually a real,
   specific `403`: `"<email> isn't a member of this team. Ask a Master to invite you from Settings
   first."` — this happens whenever someone without an active account or a pending invite tries to
   load the app (e.g., right after being removed).

**Fix:** when any request fails, show the backend's actual error message (the `message` field in
the JSON error response) instead of a generic or hardcoded fallback string. Remove the stale
"storage isn't configured" local-draft fallback entirely — real upload has been live since
2026-08-18, that code path should never trigger anymore and is actively misleading when it does.

## One more, smaller: the invite email has no link

Not a frontend bug — `FRONTEND_URL` isn't set on the backend yet, Anas needs to add it in Render's
dashboard. Once he does, invite emails will include a real "Open MMM Platform" link automatically,
no frontend change needed for this one.
