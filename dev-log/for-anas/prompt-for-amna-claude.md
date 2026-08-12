# Prompt for Amna's Claude

Copy everything below into Amna's Claude Code session, in her frontend repo (`mmm-frontend-amna`).

---

I'm working on the MMM Platform frontend (Angular, deployed at `mmm-frontend-amna.vercel.app`). The
backend team just shipped four new real endpoints that the "create a model" flow needs, and I need
help wiring them in. Here's the full picture.

## What already exists on my side

The flow today, one project at a time: Projects list → click a project → **Upload Data** screen
(model dropdown, currently just "Meridian"; a drag-and-drop file zone; a "Download a sample CSV"
link) → **Configure** screen (Date column, Target/KPI column, a Revenue/Non-revenue toggle, Media
columns, Control columns, Organic columns, a "Save configuration" button). After Upload Data, the
Configure screen already collects the right fields, they were checked against the backend's real
contract and they match. The problem: **clicking "Save configuration" does nothing** — it shows
"Configuration saved." but there was no real endpoint behind it until today, and nothing happens
next. The sidebar also lists three more steps that don't have screens yet: **Optimize**,
**Calibrate**, **Hyperparameterization**.

## The real backend, live now

Base URL: `https://mmm-back-end-anas.onrender.com/api/v1`. Every route below requires a real
Microsoft Entra bearer token (`Authorization: Bearer <token>`), same as every other authenticated
call already in the app. All four are scoped to a **dataset id**, not a project id — this matters,
see the note below.

### 1. `PATCH /datasets/:id/configuration` — wire this to the existing Configure screen

Request body:
```json
{
  "dateColumn": "Date",
  "targetColumn": "Accounts Subscriptions",
  "kpiType": "revenue",
  "mediaColumns": ["TV Cost", "Meta Cost", "Google Display Cost"],
  "controlColumns": ["Dates_School_Holidays", "Promotion"],
  "organicColumns": []
}
```
- `kpiType` is exactly `"revenue"` or `"non_revenue"` — that's what the Revenue / Non-revenue toggle
  should send.
- `mediaColumns` needs at least one entry.
- `controlColumns` can be an empty array.
- `organicColumns` is optional, omit it entirely or send `[]` if the user added none.
- The backend rejects (400) if the same column name is reused across date/target/media/control/organic.

### 2. `PATCH /datasets/:id/optimize` — new screen

Request body:
```json
{ "startDate": "2025-01-06", "endDate": "2025-07-21" }
```
- Both real ISO date strings (`YYYY-MM-DD`).
- The backend rejects (400) if `startDate` is not before `endDate`.
- This is the date range the training run actually uses — worth a one-line explanation on the
  screen, something like "Which weeks of your data should the model learn from?"

### 3. `PATCH /datasets/:id/calibration` — new screen

Request body:
```json
{ "contributionBeliefPercent": 30, "confidencePercent": 80 }
```
- Both numbers, 0 to 100 inclusive.
- These are real modeling inputs (how much of the outcome the user already believes marketing
  drove, and how confident they are in that belief), not obvious from the field names alone — worth
  a short help panel, same pattern as Upload Data's "How to prepare your data?" accordion.

### 4. `PATCH /datasets/:id/hyperparameters` — new screen, has a real dependency

Request body:
```json
{
  "channels": [
    { "channel": "TV Cost", "carryover": 0.85, "saturation": 1.5 },
    { "channel": "Meta Cost", "carryover": 0.4, "saturation": 1.1 },
    { "channel": "Google Display Cost", "carryover": 0.3, "saturation": 0.9 }
  ]
}
```
- **This one requires Configure to already be saved.** The backend checks that `channels` contains
  exactly the same channel names as Configure's `mediaColumns` — no more, no fewer, any order. If
  Configure hasn't been saved yet, or the channel list doesn't match, this returns a 400 with a real
  message explaining what's wrong (missing channels, or a channel that isn't a real media column).
  **The UI should pre-fill this screen's channel list from Configure's saved media columns**, not
  make the user retype them, both because it's better UX and because retyping invites a typo that
  the backend will then reject.
- `carryover` is 0 to 1 (how much of this week's spend is still influencing next week).
- `saturation` is 0 or above, no fixed upper bound (how fast a channel's effect flattens out as
  spend increases).

### All four endpoints, on success

Return `200 OK` with the full, updated dataset object (the same shape `GET /datasets/:id` returns).
On validation failure, `400 Bad Request` with a real, human-readable `message` field — surface that
message directly to the user rather than a generic "something went wrong."

## One real problem to fix first: the URL only carries a project id, not a dataset id

Right now the Upload Data and Configure routes look like `/upload-data/:projectId` and
`/configure/:projectId` — the URL only carries the **project's** id. But all four endpoints above
are scoped to the **dataset's** id, which only exists after a real upload succeeds (the
`POST /projects/:projectId/datasets` response includes a real `id` field, that's the dataset id).

So Configure, Optimize, Calibrate and Hyperparameterization all need to know which dataset they're
configuring, and today they only know which project. Fix: carry the dataset id forward after a
successful upload, either as part of the route (`/configure/:projectId/:datasetId`) or in route
state, and use that dataset id for all four PATCH calls, not the project id. Worth checking now
before building four screens that would otherwise all hit this same wall.

## What I'd like you to build

1. Wire the existing Configure screen's "Save configuration" button to
   `PATCH /datasets/:id/configuration`, using the real dataset id (see above), with the request
   body shape from section 1. On success, move the user forward to Optimize (build it as a
   placeholder for now if you get to it before step 2). On a 400, show the backend's real message.
2. Build the Optimize, Calibrate and Hyperparameterization screens, calling endpoints 2, 3 and 4
   above. Match the visual style already established on Upload Data and Configure (same brand kit,
   same help-accordion pattern where a screen's fields aren't self-explanatory).
3. Hyperparameterization's channel list should come from Configure's saved `mediaColumns`, not be
   retyped by the user.

Nothing past Hyperparameterization is built on the backend yet (there's no "start training" step
yet, that's still blocked on a separate question to the modeling team), so it's fine for
Hyperparameterization's own save button to just confirm success for now with no further navigation.
