# Prompt for Amna's Claude — the "Download sample" button isn't using our real backend file

Copy everything below into Amna's Claude Code session. Real bug found today: the sample dataset
download doesn't come from the backend at all.

## What's happening

Clicking "Download sample dataset" (or wherever it's linked in the app) downloads a file called
something like `sample-mmm-dataset...csv` with these columns:

```
week_start, total_revenue, paid_search, tv_spend, paid_social, is_holiday_week, organic_social_posts
```

That's not from our backend — it looks like a small, separately bundled sample file living
somewhere in the frontend project itself (static asset, or hardcoded in a component).

## What it should be

The real backend endpoint is `GET /samples/dataset.csv` (no auth required, `@Public()`) — confirmed
live right now, serving the real file Anas asked for: 157 real weeks (2022-01-03 to 2024-12-30),
columns:

```
Date, Accounts Subscriptions, Google Display Cost, Google Branded Paid Search Cost, TV Cost,
Google Generic Paid Search Cost, Influencers Cost, Meta Cost, YouTube Cost, Dates_School_Holidays,
Competitors Promotion, Promotion
```

Find wherever the "Download sample" button/link points today and change it to hit that real
backend URL instead (`{API_BASE_URL}/samples/dataset.csv`), so it downloads the real file directly
from the backend rather than a separate bundled copy that's now out of date. If there's a bundled
static file sitting in the frontend repo for this, it can be deleted once the button points at the
real endpoint — no reason to maintain two different sample files that can drift apart, which is
exactly what just happened.
