# Prompt for Amna's Claude — one-click "Combine what's flagged" button

Copy everything below into Amna's Claude Code session, in her frontend repo.

## The real gap this closes

Today's real training failure (`paid_social_spend`, extreme multicollinearity) only got fixed
because Anas manually noticed the Optimize correlation table and picked the pair to combine by
hand. Nothing suggested it or acted on it automatically. New endpoint closes that gap.

## New endpoint

**`POST /datasets/:id/auto-combine-channels`** — no body needed. Finds every real group of media
columns correlated 90%+ (chained — if A and B are 90%+ correlated, and B and C are too, all three
group together, not just isolated pairs), and combines each group for real in one call, same effect
as calling `combine-channels` once per group.

Response:
```json
{
  "dataset": { "...": "the updated dataset, same shape as combine-channels returns" },
  "combined": [["tv_spend", "paid_social_spend"]]
}
```

`combined` is empty (`[]`) if nothing was correlated enough to combine — that's a real, valid
outcome, not an error.

## What to build

On the Optimize screen's "Why combine similar channels?" panel, add a button above or alongside the
manual picker: **"Combine what's flagged"**. On click:
- Call the new endpoint.
- If `combined` is non-empty, show what got combined (e.g. "Combined: tv_spend + paid_social_spend
  → tv_paid_combined") and the same "Hyperparameterization needs a redo" message the manual combine
  already shows (same real cause — `channelHyperparameters` gets cleared here too).
- If `combined` is empty, show something like "Nothing's correlated enough to need combining" —
  not an error state, just a plain confirmation.

The manual picker (pick two columns, name the field, click Aggregate) should stay exactly as it is,
for anyone who wants to combine a specific pair the auto version didn't flag. This is an addition,
not a replacement.
