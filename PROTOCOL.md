# Working protocol

This is the fixed process every piece of backend work follows. Anas asked for
this on 2026-08-04, so that the way this project gets built is a known,
repeatable process, not something that depends on memory or improvisation.
Read this once. After that, if something feels rushed or undocumented, it
means this protocol wasn't followed, and that's worth flagging.

## 1. What "done" means

A piece of work is only marked done when every one of these is true:

1. It compiles, lints, and passes its tests.
2. It has been run against something real, not just checked on paper. A
   database migration is only done once it has actually run against a live
   Postgres and someone looked at the resulting table. An endpoint is only
   done once it has actually been called and returned the right thing.
3. It has been verified from **two independent angles**. See section 3.
4. It's written down in the dev log (`dev-log/`), the same day.
5. Anything left unresolved is named as an open question (section 6), not
   silently guessed at.
6. **If it introduced a real concept, not just a CRUD endpoint, a lesson
   got written for it, the same day, before calling it done.** Not after,
   not "when there's time." This slipped twice already: `CMP-42` shipped
   real Row-Level Security, a superuser bug, and AsyncLocalStorage with
   zero teaching, and Anas had to point it out both times rather than it
   being automatic. It belongs in this list, not a separate section
   further down that's easy to reach "done" without ever revisiting.
7. **If it's something Anas can actually click through and check, it gets
   a case in `dev-log/for-anas/test-cases.html`, not a one-off walkthrough
   buried in the progress log.** Added 2026-08-05, after the progress page
   accumulated three separate hands-on sections that nobody was ever going
   to re-run. A test case only counts as `Passing` once Anas has run it
   himself, same rule as the "Done" badge everywhere else.
8. **Every step in a test case (or any guided walkthrough) is detailed
   enough that Anas never has to guess what to click.** Added 2026-08-05,
   same day, after `TC-04`'s first version ("Authorization tab, Get New
   Access Token, sign in, Use Token") turned out to be three lines
   assuming Postman OAuth familiarity he doesn't have. He hit `401
   Missing or malformed Authorization header` and said plainly: "there's
   no guide, nothing at all." A real guide names the exact tab, what the
   button looks like, what screen appears next, what a wrong outcome
   looks like and what to do about it, and a way to check the work before
   the risky click (here: check the Headers tab for a real Authorization
   header **before** clicking Send, not after it fails). Three numbered
   lines is not a guide, it's a summary of one. Never confuse the two
   again, for this or any future walkthrough.
9. **If a test case sends Anas to a Postman collection request, and that
   request didn't exist in his Postman before, the instructions must
   include importing the updated collection file first.** Added
   2026-08-06, after `postman/MMM-Backend.postman_collection.json` was
   edited to add a `Projects (CMP-41)` folder and Anas correctly pointed
   out "nothing added today", his Postman still only showed Health and
   Auth. Editing the file on disk changes nothing in an already-imported
   collection; only re-importing does. Confirmed the same day: re-importing
   the file over an existing collection with the same name, even with no
   `_postman_id` in the file, offered a clean **Replace** option in
   Postman's import dialog rather than creating a duplicate, so the
   guide's original "expect a second collection" warning was itself wrong
   and has been corrected. The lesson isn't "expect a duplicate", it's
   "don't guess what Postman's import dialog will do, confirm it and write
   down what actually happened."

"The code looks right" is never enough on its own. Point 2 is the one most
often skipped elsewhere, and it's the one this project checks hardest.
Points 6, 7, 8, and 9 are the newest additions and the ones most likely to
get skipped next, watch them specifically.

**On the `for-anas/progress-log.html` page specifically: a green "Done"
badge means Anas personally ran the check, not just Claude.** This was
broken once, on 2026-08-04 (two rows said "Done" based only on Claude's own
`psql` check), and Anas caught it. If Claude has verified something but
Anas hasn't yet, the badge says so honestly ("not checked by you") instead
of rounding up to "Done."

## 2. How a piece of work gets built

1. **Decide, don't improvise.** If a choice affects shared code or is hard
   to reverse (which library, which folder structure, which naming
   convention), it gets asked explicitly rather than picked silently.
2. **Build it.**
3. **Verify it myself first**, against something real: run it, call it,
   query the actual database. Not just "the tests pass."
4. **Hand you an exact, numbered way to verify it yourself**, even after I
   already have. If it needs something only you can do (installing
   software, clicking through your own Postman, approving a real decision),
   that's a precise, ordered list, not a vague pointer.
5. **Log it**, the same day, in **both** `dev-log/raw/YYYY-MM-DD.md` (the
   technical version) **and** `dev-log/for-anas/progress-log.html` (the
   status page Anas actually reads). These are not interchangeable: updating
   `raw/` alone is not "logging it." This slipped once already, on
   2026-08-04, when two rounds of real work updated `raw/` but not
   `for-anas/`, and Anas caught it. Every time `raw/` gets a new entry,
   `for-anas/` gets touched in the same pass, not "later."

## 3. Verification always has two independent angles

One check from the terminal or code is not proof. The pattern used so far,
and the one to keep using:

| What | Angle 1 (me) | Angle 2 (you) |
|---|---|---|
| An API endpoint | `curl` from the terminal | The same request in Postman |
| A database table | Query it directly with `psql` | You run the same query yourself in `psql` (see section 8) |
| A UI change | Load it in the browser tool myself | You look at it running |

If the two angles disagree, nothing is marked done until they match.

## 4. What I do myself vs. what needs you

**I do these myself, without asking each time:** writing code, running
tests, starting and stopping local services I started, querying the local
database to verify something, editing config files, renaming things, fixing
bugs I find.

**These always come to you as an exact, numbered list, because they are
either outside what I should do unattended or something only you can click
through:** installing software, changing Windows/system settings, anything
inside your own Azure or Microsoft account, anything inside Postman that
needs your login, and any decision that isn't purely technical (see
section 6).

**These always get confirmed with you first, every time, even if approved
before:** deleting anything that isn't obviously disposable, pushing to a
shared repo, changing anything already deployed.

## 5. Naming and structure

Decided once, then applied consistently rather than re-decided per file:

- kebab-case file and folder names, PascalCase classes, camelCase in code
  mapped to snake_case database columns. Full detail in `CONTRIBUTING.md`.
- One folder per feature under `src/modules/`, same shape every time
  (`module.ts`, `service.ts`, `entities/`). See `README.md`'s "Adding the
  next module" section.
- Product name is **MMM** (not "CRAS MMM") as of 2026-08-04, per Anas.
  Flagged as not yet confirmed as the final product name. If it changes
  again, it needs the same full sweep this rename got: code, config, Docker,
  Postman, docs, memory, done in one pass, not left half-done.

## 6. Open questions get named, not guessed at

If a decision is genuinely unresolved and isn't a coding question (example:
how a real login maps to a company account, decided at
`README.md`'s "Auth setup" section), it gets written down explicitly as an
open question, with who actually owns that decision, instead of picking a
plausible-sounding answer and moving on. An invented answer that turns out
wrong is far more expensive to undo than an honest "not decided yet."

## 7. Safety boundaries that never change

Regardless of how routine something feels: no destructive action on
anything that isn't trivially recreatable (a local Docker volume with no
real data in it is fine to drop; anything with data you'd miss is not),
nothing gets pushed to a shared remote without you saying so, and nothing
involving your Azure or Microsoft account gets touched by me directly. This
matches the standing rule Anas set for how this whole project runs (see
`dev-log/README.md`).

## 8. Teaching happens every day, not on request

**See section 1, point 6 first** — this is no longer a separate step to
remember after shipping something, it's part of what "done" means, checked
at the same moment as everything else in that list.

Anas is directing this build, not writing the code, and said plainly on
2026-08-04 that he needs to understand everything well enough that nobody
can question how he's working, not just click through steps handed to him.
So:

- **Every session that touches the backend includes at least one real,
  hands-on thing Anas does himself and understands**, not a status report
  he takes on faith. Not optional, not deferred to "the next lesson."
- **A claim of "Done" is not teaching.** Explaining why something works, and
  having Anas do it himself at least once, is. The database-query
  walkthrough on `for-anas/progress-log.html` is the model to repeat: plain
  words first, then exact commands, then what the real result means.
- **Bigger concepts** (why Auth, Docker, and Postgres fit together the way
  they do) get a proper lesson page under `Trainings\NestJS\knowledge-base\
  lessons\`, same rigor as the existing ones. **Small, immediate skills**
  (run this query, hit this endpoint, read this log line) get taught inline,
  hands-on, the same day they come up, not saved for a future page.
- If a session goes by where Anas only received a status update and never
  did or understood something new, that's the protocol not being followed.

**Hard requirement, added 2026-08-04 after it broke twice in one day:**
when a claim, recommendation, or tool changes (example: "use pgAdmin, not
raw `psql`"), grep `for-anas/progress-log.html` for every trace of the old
one before saying anything is fixed. A fix that only touches the paragraph
Anas pointed at is not a fix; it already contradicted a different part of
the same page once. "I updated the recommendation" and "the page is
consistent" are different claims, only the second one is done.
