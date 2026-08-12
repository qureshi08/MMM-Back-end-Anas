# Prompt for Amna's Claude — follow-up (Configure bug + real column picker)

Copy everything below into Amna's Claude Code session, in her frontend repo (`mmm-frontend-amna`).
This follows an earlier prompt (`prompt-for-amna-claude.md`) about wiring Configure/Optimize/
Calibrate/Hyperparameterization to the real backend. Two things came up after that one landed.

---

## 1. A real bug: Configure's Save button throws `Validation failed (uuid is expected)`

Anas tried the real Configure screen after Save Configuration was wired up, filled in real values
(Media columns: `tv`, Control columns: `seasonality`), clicked **Save configuration**, and got:

```
Validation failed (uuid is expected)
```

That exact message comes from the backend's `ParseUUIDPipe` rejecting the `:id` in
`PATCH /datasets/:id/configuration` — meaning whatever value is being sent in that URL slot isn't a
real UUID. This is almost certainly the routing gap flagged in the first prompt: the screen only
knows the **project's** id (from the URL, `/configure/:projectId`), and is sending that where the
**dataset's** id needs to go. A project id and a dataset id are both real UUIDs individually, so if
the wrong one is being sent the error would be different (a 404, not this) — check first whether
what's actually being sent is `undefined`, an empty string, or literally the string `:id` un-
substituted, any of which would produce exactly this message. Fix: make sure the real dataset id
(the `id` field from the `POST /projects/:projectId/datasets` response, or from
`GET /projects/:projectId/datasets` if reopening an existing one) is what's actually in the URL when
the PATCH fires, not the project id and not a missing value.

## 2. The bigger issue Anas raised: Configure asks the user to retype column names from memory

Look at what the real screen was asking for: a blank text box under "Media columns" where the user
typed `tv`, and another under "Control columns" where they typed `seasonality`. Neither of those
matches any real column in an uploaded file — a real file has columns like `TV Cost` and
`Dates_School_Holidays`. There's nothing on screen telling the user what their file's columns
actually are, so they're guessing, and the backend's real check (column names must be exact) will
keep rejecting guesses. Anas's words: "the user's flow is very off, he does not even know what to
do." He's right, this is a real design gap, not a nitpick.

The fix: a new backend endpoint reads the real file someone already uploaded and returns its real
column names, so the frontend can show a **pick-list of real columns**, not an empty text box.

### `GET /datasets/:id/columns`

No body. Real dataset id in the URL, same auth as everything else. Response:
```json
{ "columns": ["Date", "Accounts Subscriptions", "Google Display Cost", "TV Cost", "Meta Cost", "Dates_School_Holidays", "Promotion"] }
```
- CSV files only for now — XLSX and Parquet return a `400` with a clear message
  ("Reading column names is only supported for .csv files today...") since the backend doesn't parse
  those formats yet. If that happens, fall back to the old free-text input for that one dataset
  rather than breaking the screen.
- This reads the real file's real header row, in the real order it appears in the file.

### What to build with it

On the Configure screen, right after it loads (it already knows the real dataset id, same one the
Save button needs):
1. Call `GET /datasets/:id/columns` once, store the result.
2. **Date column** and **Target/KPI column**: turn these into single-select dropdowns populated
   from that list, instead of free text.
3. **Media columns**, **Control columns**, **Organic columns**: turn these into multi-select
   pick-lists (checkboxes, tags, whatever fits the existing design system) from the same list,
   instead of "type a name, click + Add column."
4. A column picked in one list should probably disappear from the others, or at least warn if picked
   twice — the backend already rejects a column reused across roles (400, "the same column name is
   used more than once"), so catching it in the UI before Save avoids the round trip.
5. If the `GET /datasets/:id/columns` call itself 400s (non-CSV file), show a plain message like
   "Automatic column detection isn't available for this file type yet, enter column names manually"
   and fall back to the original text inputs, don't just break.

This directly fixes what Anas flagged: the user is choosing from their own real columns, not
remembering and retyping them.
