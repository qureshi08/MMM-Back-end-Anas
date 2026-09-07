# Prompt for Amna's Claude — Channel Health: real VIF fallback, `vifIsApproximate`

Copy everything below into Amna's Claude Code session. Answers your question about `vif: null`.

## Short answer: yes, it's feasible, and it's done

`GET /datasets/:id/channel-health` now returns a real ridge-regularized VIF instead of `null` in
the case you asked about (two *other* channels being exactly collinear, which made the plain
regression have no unique answer). Every channel entry now also has:

```json
{ "channel": "display_spend", "vif": 3.2, "vifIsApproximate": true, ... }
```

`vifIsApproximate: true` means this number came from that real fallback, not the plain textbook
formula — still a real, computed number, just worth a slightly softer real caveat in the UI than a
plain VIF gets (something like a small "approximate" label or tooltip next to the value, your call
on the exact treatment).

## `vif` is still genuinely `null` in two real cases, unchanged

- Only one real media column exists (nothing to compare it against) — a structural fact, not
  something regularizing can fix.
- Fewer real rows than channels (not enough real data for a stable fit at all).

Keep your existing "not enough data" handling for those two — nothing else changes for them.
