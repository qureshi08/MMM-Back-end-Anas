# Prompt for Amna's Claude — combine channels needs to be real, and show the real training error

Copy everything below into Amna's Claude Code session, in her frontend repo.

## 1. Confirmed real bug, with the exact evidence

Anas trained a real model, Meridian correctly rejected it:

```json
{
  "status": "failed",
  "errorMessage": "Training failed: Model has critical EDA issues. ... Check type: MULTICOLLINEARITY\n- Some variables have extreme multicollinearity (VIF > 1000)... Variables with extreme VIF: ['paid_social_spend']"
}
```

The Optimize page had already flagged `paid_social_spend` as 98% correlated with another channel,
and "Combine similar channels" was used to merge it. It still failed, because that button only ever
called `POST /datasets/:id/combine-columns` — the **chart preview** endpoint. It never changed
`columnMapping.mediaColumns`, so `paid_social_spend` still went to training as a separate, raw,
highly collinear column.

## 2. The real fix, backend already built and deployed

**New endpoint**: `PATCH /datasets/:id/combine-channels`

```json
{ "sourceColumns": ["tv_spend", "paid_social_spend"], "newColumnName": "tv_social_combined" }
```

This actually updates `columnMapping.mediaColumns` (removes the two source columns, adds the new
combined one) and saves the combination so Assembly sums it into every real row before training,
every time, not just for the chart.

**Wire the "Aggregate" button to call this too**, alongside (or instead of) the existing chart
preview call — both can run, the chart call for the immediate visual, this one for what actually
gets trained.

**Important side effect**: this endpoint clears `channelHyperparameters` on the dataset (returns
`null`). That's intentional — the old per-channel carryover/saturation values no longer match the
new combined channel list, Hyperparameterization needs to be redone. Please show something like
"Media channels changed — Hyperparameterization needs a quick redo before training" rather than
letting the user hit a confusing Configure-mismatch error at Train Model time.

## 3. Still needed: show the real training error, not just "Training failed."

From the earlier prompt, not yet done: when `GET /datasets/:id/status` returns `status: "failed"`,
display the real `errorMessage` (like the multicollinearity one above) instead of a generic banner.
It's often long and technical (like this one) — a collapsible "details" section is fine, doesn't need
to be pretty, just visible without opening DevTools.
