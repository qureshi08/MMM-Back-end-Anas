# Prompt for Amna's Claude — auto-combine-channels response shape fixed, drop the diffing

Good catch flagging the order-correspondence assumption before it shipped — fixed properly on the
backend instead of leaving it as a frontend workaround.

`POST /datasets/:id/auto-combine-channels` now returns `combined` as an array of real objects, not
bare arrays:

```json
{
  "dataset": { "...": "..." },
  "combined": [
    { "sourceColumns": ["tv_spend", "paid_social_spend"], "newColumnName": "tv_paid_combined" }
  ]
}
```

Please drop the diffing logic that derives the new column name by comparing `mediaColumns`
before/after — `combined[i].newColumnName` and `combined[i].sourceColumns` are both right there
now, explicit, nothing to infer. Same for the message text: `"Combined: " + sourceColumns.join(" + ") + " → " + newColumnName`
reads straight off one object per group.
