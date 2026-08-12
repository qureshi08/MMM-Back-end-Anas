# Dev log

A running record of what has actually been built in `Backend\`, why, and what
state it's in. Two audiences, two formats:

- **`raw/`** — my own working notes, one file per date, technical and terse.
  Markdown, not meant to be pretty. Read this if you (future Claude, or
  anyone technical) need the detail behind a status line in the other folder.
- **`for-anas/progress-log.html`** — the human-readable version. One page,
  brand-kit styled, opens directly from disk. This is the one to read (or
  show someone) to answer "what's done, what's not, what's blocked, and
  why." Updated every time `raw/` gets a new entry.
- **`for-anas/test-cases.html`** — the actual, reusable test suite. Added
  2026-08-05, after `progress-log.html` had accumulated three separate
  one-off hands-on walkthroughs that nobody was ever going to re-run. Every
  real, clickable check lives here instead: preconditions, exact steps,
  expected result, and a status that only flips to `Passed` once Anas has
  personally run it. This is what stands in for an automated end-to-end
  suite until one exists, re-run it after anything that plausibly touches
  it, not just once and forgotten.
- **`for-anas/deployment-guide.html`** — added 2026-08-06, click-by-click
  steps for getting the backend onto GitHub and Render as a shared Dev
  environment Amna can reach. Temporary, replaced once real Azure App
  Service exists, but written with the same "detailed enough to actually
  follow" standard as the test cases and the Postman/Entra debugging that
  proved a terse guide isn't enough.

## Why this exists

Anas asked on 2026-08-04: *"how did we make it, when I will be asked if Auth
module is done, what should I say?"* He directs the work but doesn't write
the code, so without a log he has no way to answer that question except to
ask me live. This folder is the answer he can read on his own, or hand to
someone else.

## Keeping it current

Add a new `raw/YYYY-MM-DD.md` entry at the end of any session where real
progress happened (a module built, something verified, a decision made, a
blocker hit). Then update `for-anas/progress-log.html`: the status table at
the top and a matching timeline entry. Don't let the two drift apart — the
HTML page's claims must trace back to something in `raw/`.
