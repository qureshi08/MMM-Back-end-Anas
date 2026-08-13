# Prompt for Amna's Claude — none of the last two fixes actually landed, plus new real bugs

Copy everything below into Amna's Claude Code session, in her frontend repo (`mmm-frontend-amna`).
Anas re-checked prompts 6 and 7 himself on the real deployed app. Neither is actually fixed, and he
found three more real, concrete bugs while checking. Please verify each fix yourself in the real
running app before reporting back this time — "done" that isn't checked has cost real time twice now.

## 1. Prompt 7 (screens losing saved data): still broken, unchanged

Confirmed again: leave any step and come back, it's still blank. If this was worked on, the fix
didn't take, or something reverted it. Re-read `prompt-for-amna-claude-7.md` in full and re-verify:
does the Upload Data / Configure / Optimize / Calibrate / Hyperparameterization screen actually call
`GET /datasets/:id` on mount and populate its form fields from the response? Test it exactly like
this: save a real value on Configure, click Back, click back into Configure — is the value there?
If not, the fix isn't in yet, find out why before saying it is.

## 2. Prompt 6 (mock Train Model): still shows "Coming soon," never wired

The button on the Models list still reads `Train Model [COMING SOON]`, disabled, on a model that's
100% "Ready." That means `POST /datasets/:id/train` was never actually called from anywhere. Re-read
`prompt-for-amna-claude-6.md`. The three real endpoints (`POST /datasets/:id/train`,
`GET /datasets/:id/status`, `GET /datasets/:id/results`) are live and tested on the backend, this is
purely a "nothing calls them yet" problem on the frontend.

## 3. New: `GET /projects` now returns a real `datasetCount`, fixed today

The Projects page showing "0 models" for a project that has real models was a real backend gap:
`GET /projects` never returned a count at all. Fixed just now, both `GET /projects` (the list) and
`GET /projects/:id` (one project) now include a real `datasetCount` field:

```json
{ "id": "...", "name": "Testing by Anas", "...": "...", "datasetCount": 4 }
```

Use this real field for the "N models" text on the Projects page instead of whatever it's currently
showing (looked hardcoded to 0). `experimentCount` doesn't exist yet, Experiments isn't built, 0 is
correct there for now, that part's fine as is.

## 4. New: clicking "Open Model" in the project detail popup doesn't open anything

Real bug, needs your own investigation first: what does "Open Model" actually do right now, does it
navigate at all, does it throw a console error, does it 404? Check the browser console and the
Network tab when clicking it, that'll say what's actually happening. Once you know the real cause,
fix it, don't guess at a fix without seeing the real error first.

## 5. New: "Edit" on a model traps the user, no way out except finishing setup

Clicking Edit on a model opens its build flow, and from there there's no way to leave except
completing every remaining step. This directly breaks the persistent-nav requirement from
`prompt-for-amna-claude-4.md`: **every screen inside a model's flow must have a working exit (Back
to Projects, or the Models list) at all times, never gated behind finishing configuration.** Check
whatever guard or route logic is blocking navigation away from an incomplete model and remove the
block, an incomplete model should be perfectly fine to leave and resume later, that's the entire
point of the real "Continue Setup" vs "Uploaded/Configured" progress states already on the Models
list.

## Before reporting back

For each of the five items above, actually click through it yourself in the real deployed app first.
"I made the change" is not the same as "I confirmed it works." Anas will be re-checking every one of
these himself again regardless, but two false "done"s in a row is worth a real pause to actually test
before saying so.
