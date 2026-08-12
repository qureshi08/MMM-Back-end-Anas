# Prompt for Amna's Claude — follow-up (two real fields Hammad flagged missing)

Copy everything below into Amna's Claude Code session, in her frontend repo (`mmm-frontend-amna`).
Follows `prompt-for-amna-claude-4.md`.

---

We talked to Hammad directly today. He looked at the real Configure screen and said it "feels like
some data is missing." Cross-checked his own API Contracts document (the real source of truth for
what his model needs) against what Configure actually collects, and he was right: two real, required
fields were missing. Both are now live on the backend.

## `PATCH /datasets/:id/configuration` — updated real shape

```json
{
  "dateColumn": "Date",
  "targetColumn": "Accounts Subscriptions",
  "kpiType": "non_revenue",
  "revenuePerKpiValue": 50,
  "mediaColumns": ["TV Cost", "Meta Cost", "Google Display Cost"],
  "controlColumns": ["Dates_School_Holidays", "Promotion"],
  "organicColumns": [],
  "geoColumns": []
}
```

Two new fields, both need real UI:

### 1. `revenuePerKpiValue` — a new field, conditionally required

- **Required whenever `kpiType` is `"non_revenue"`.** Real dollar value of one unit of the KPI —
  if the KPI is subscriptions and each one is worth about $50 in revenue, this is `50`.
  **Must be left out entirely when `kpiType` is `"revenue"`** (the backend rejects it with a 400 if
  you send it there, the KPI's already in dollars, converting it again doesn't mean anything).
- **Build:** show a new numeric input, "Revenue per [KPI unit]" or similar, **only when the
  Non-revenue KPI toggle is selected**, hidden when Revenue is selected. Real example copy:
  "How much is one [subscription / signup / whatever the KPI is] worth in real revenue?"

### 2. `geoColumns` — a new optional multi-select, same pattern as Organic Columns

- Geographic breakdown columns, if the dataset has any (region, country, state, whichever columns
  exist). Genuinely optional, omit or send `[]` if none.
- **Build:** a new "Geo columns (optional)" pick-list, identical pattern to the existing "Organic
  Columns" field — same real column list from `GET /datasets/:id/columns`, same multi-select UI.

## Where to put it on the screen

Both fields belong on the existing Configure screen, not a new one. Suggested order: Date column,
Target/KPI column, Revenue/Non-revenue toggle, **Revenue per KPI value (conditional)**, Media
columns, Control columns, Organic columns, **Geo columns (new)**.

No backend blocker here, both fields are live now, this is purely two new inputs on a screen that
already exists and already calls the right endpoint.
