# Prompt for Amna's Claude — real bug: nothing re-loads saved data, not a backend problem

Copy everything below into Amna's Claude Code session, in her frontend repo (`mmm-frontend-amna`).
Anas confirmed this directly: leave any step (Upload Data, Configure, Optimize, Calibrate,
Hyperparameterization) and come back to it — even right after saving it — and it shows a blank form,
name and all, as if nothing was ever saved.

## This is not a backend problem, here's the real evidence

The Models list (`/models/:projectId`) shows four real datasets with different, real, persisted
progress: `Ready 100%`, `Configured 40%`, `Uploaded 20%`, `Ready 100%`. That list is built from
`GET /projects/:projectId/datasets`, and it could not show varied real progress like that unless
every save along the way was genuinely landing in the database. So Save is working. The bug is on
the other side: **loading a step never reads back what Save already wrote.**

A network capture confirms this concretely: reopening Upload Data made a request that came back with
a `Project` object (`ownerId`, `status: "active"`, no dataset fields at all, and dated
`2026-08-10`, days old) — not a dataset. That screen isn't even asking the backend for the dataset's
saved state when it reloads.

## The real fix: every step screen needs to hydrate from `GET /datasets/:id` on load

This already returns everything every step needs, all real, all tested today:

```json
{
  "id": "...", "name": "Testing by Anas",
  "columnMapping": { "dateColumn": "...", "targetColumn": "...", "mediaColumns": [...], "controlColumns": [...], "organicColumns": [...], "geoColumns": [...] },
  "kpiType": "non_revenue", "revenuePerKpiValue": 50,
  "dateRange": { "startDate": "...", "endDate": "..." },
  "calibration": { "contributionBeliefPercent": 30, "confidencePercent": 80 },
  "channelHyperparameters": [ { "channel": "...", "carryover": 0.4, "saturation": 1.1 } ]
}
```

Each field is `null` until its own step was actually saved, exactly matching "Uploaded" (only
`name` set) vs "Configured" (`columnMapping`/`kpiType` set, rest still `null`) vs "Ready" (all set)
in the Models list.

**What to build, one fix applied to every step screen, not five separate ones:**

1. On mount, call `GET /datasets/:id` using the real dataset id already in the URL.
2. Pre-fill that screen's form fields from the matching part of the response:
   - Upload Data: `name`, and show the already-uploaded file's name if `columnMapping` or later is
     set (the file itself doesn't need re-uploading, just reflect that one exists).
   - Configure: `columnMapping.*`, `kpiType`, `revenuePerKpiValue`.
   - Optimize: `dateRange.startDate` / `dateRange.endDate`.
   - Calibrate: `calibration.contributionBeliefPercent` / `confidencePercent`.
   - Hyperparameterization: `channelHyperparameters` (already being read correctly here for the
     channel *names*, per earlier prompts, this is about the carryover/saturation *values* also
     needing to load, not just the channel list).
3. If a field is `null` (that step was never saved), leave the input empty/default, same as today.
4. This should replace whatever local-only state each screen currently initializes with on mount —
   the real saved state from the backend is the actual source of truth, local state should be
   populated from it, not the other way around.

This is the same fix in five places, not five different bugs. Worth checking whether all five
screens share a common data-loading pattern already (a hook, a loader) so this is one real change,
not five copies of it.
