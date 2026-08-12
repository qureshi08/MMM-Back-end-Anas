# Prompt for Amna's Claude — follow-up (autofill, and the missing "outside the model" navigation)

Copy everything below into Amna's Claude Code session, in her frontend repo (`mmm-frontend-amna`).
Follows `prompt-for-amna-claude.md` and `prompt-for-amna-claude-2.md`. Two more things came up after
seeing the real Hyperparameterization screen working (channels correctly pulled from Configure,
good) and comparing the real flow against Cassandra, a mature product in the same space.

---

## 1. Autofill Configure from the real file, like Cassandra does

Cassandra's own Configure screen loads with real values already picked: a KPI, an Output column, a
Date column, a set of Paid Marketing Columns, all pre-filled from the file, that the user can then
adjust. Ours currently loads every field empty and asks the user to build the picks from scratch. Anas asked directly: "like Cassandra the columns should be autofilled, no?" Yes.

`GET /datasets/:id/columns` (already covered in the previous prompt) now returns more than the flat
column list:

```json
{
  "columns": ["Date", "Accounts Subscriptions", "TV Cost", "Meta Cost", "Dates_School_Holidays", "Promotion"],
  "suggestions": {
    "dateColumn": "Date",
    "targetColumn": "Accounts Subscriptions",
    "mediaColumns": ["TV Cost", "Meta Cost"],
    "controlColumns": ["Dates_School_Holidays", "Promotion"],
    "organicColumns": []
  }
}
```

This is plain name-pattern matching on the backend (a column called `TV Cost` is obviously spend,
one called `Date` is obviously the date), not machine learning, and it's deliberately conservative:
`dateColumn`/`targetColumn` come back `null` if nothing matches rather than guessing wrong. Verified
against the real sample dataset, it correctly sorts all 12 real columns into their real roles.

**What to build:** when Configure loads, call this endpoint once and pre-select the pick-lists
(built in the previous prompt) using `suggestions` — `dateColumn`/`targetColumn` pre-selected in
their dropdowns, `mediaColumns`/`controlColumns`/`organicColumns` pre-checked in their multi-selects.
The user still sees and can change every pick before saving, same as Cassandra's chips are
removable. Nothing gets saved to the backend until they click Save Configuration themselves.

## 2. There's no way out of a model, and no place that shows all of them

Anas's exact words: "for now we have only model level navigations and not global level, and we
cannot even move out from there. No real product feel." Comparing to Cassandra's real dashboard: a
persistent left sidebar (Dashboard, Models, Budget Allocator, ...) that exists everywhere, and a
`Dashboard` page listing every model with a real status and progress bar (`Configure`, 25%; `Ready
For Training`, 50%; `Completed`, 100%) and a matching action per row (`Continue Setup`,
`Train Model`, `View Model`). Our current app has none of that: once inside Upload Data → Configure
→ Optimize → Calibrate → Hyperparameterization, there's no visible way back to the project or to any
list of models, the sidebar only contains those 5 steps.

Two real, separable pieces:

**a) A persistent way out.** Every one of the 5 model-build screens should have a fixed "Exit" or
"Back to project" control, visible the whole time, not just a browser back button. Cassandra puts it
top-right on every screen (`← Back` and `Exit` both visible in their screenshots). Doesn't need to be
fancy, just always there.

**b) A real per-project models list, with real status.** `GET /projects/:projectId/datasets` already
returns every dataset for a project, and each dataset object already carries everything needed to
compute a real progress state, no backend change needed for this part:

| Condition | Status | Suggested % |
|---|---|---|
| `columnMapping` is `null` | Uploaded | 20% |
| `columnMapping` set, `dateRange` is `null` | Configured | 40% |
| `dateRange` set, `calibration` is `null` | Optimized | 60% |
| `calibration` set, `channelHyperparameters` is `null` | Calibrated | 80% |
| `channelHyperparameters` set | Ready (Hyperparameterization done) | 100% |

Build a real page (or repurpose the project's own page) that lists a project's datasets with this
computed status and a progress bar, same shape as Cassandra's table, with a `Continue Setup` action
that resumes wherever that dataset left off.

## 3. What's still correctly not built, and how to end the flow honestly instead of abruptly

`Train Model` doesn't exist yet because there's no real place for the backend to send a "start
training" job, that's a live, blocking question to the modeling team (Hammad), being asked directly
tomorrow. Once that's answered, a real endpoint gets built and a real prompt will follow. That does
not mean Hyperparameterization should just dead-end with nothing after it, a hard stop reads as
broken, not as "not built yet."

Instead, give the flow a real last screen: once Hyperparameterization is saved, show something like
"Setup complete" with a `Train Model` button that's visibly disabled (grayed out, a "Coming soon"
label or tooltip), maybe a line explaining training isn't wired up yet. Same idea in the models list
from part (b) above: a dataset at 100% shows `Train Model`, disabled, not `Continue Setup` (there's
nothing left to configure) and not a working button (there's nowhere to send the job yet). Honest
about what's missing, but the product stops feeling like it just ends.
