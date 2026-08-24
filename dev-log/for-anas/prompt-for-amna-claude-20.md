# Prompt for Amna's Claude — build a real story from results, not just basic graphs

Copy everything below into Amna's Claude Code session. This answers "what else can we show in
results" — split into what's usable right now with zero backend changes, and 3 new fields just
added that unlock more.

## Part 1: reframe what's already there — no new field needed

The current results screen shows numbers. It should show sentences. Same real data, different
presentation:

- **Lead with `budget_recommendation` as the headline, not a footnote.** It's already a decision:
  "Move $X from [channel] to [channel] — marginal ROI is higher there." Show that sentence first,
  the table second.
- **Pair `roi` and `marginal_roi` from `channel_efficiency` into one diminishing-returns story.**
  When average ROI is healthy but marginal ROI is much lower, that's "you're already near this
  channel's ceiling — more spend won't help much." Say that, don't just show two numbers.
- **`saturation_curves` + `historical_spend_distribution` already show where a channel sits on its
  own curve.** Caption it: "you're spending $X, already at Y% of this channel's max effect."
- **`adstock_decay_curves` tells a pacing story.** "Half of what you spend here stops working
  within N weeks — steady spend beats big spikes" is a real sentence the curve already supports.

## Part 2: 3 new real fields, just added to the results contract

All three are populated with real (deterministic, reacting to real inputs) values in the mock
right now, and will be filled by the real engine with zero backend change once Hammad adds them
on his end — build against the mock today.

- **`actual_vs_predicted`** — array of `{ date, actual, predicted }`, one point per real date in
  the dataset. A real line chart showing the model's fit over time — how close the model's guess
  tracks what actually happened.
- **`channel_confidence`** — array of `{ channel, roi_low, roi_high, confidence_percent }`. A real
  range around each channel's ROI, not just a single point estimate — show as an error bar or
  range next to the ROI number in `channel_efficiency`, e.g. "ROI: 2.1x (likely between 1.8x and
  2.4x)."
- **`baseline_vs_marketing`** — `{ baseline_outcome, marketing_outcome, baseline_percent,
  marketing_percent }`. What would have happened with zero marketing vs. what marketing actually
  added — a real stacked bar or donut showing the split is the clearest way to answer "is
  marketing even working" at a glance.

All three fields are optional on the type — check for their presence before rendering (`if
(results.actual_vs_predicted) { ... }`), since older completed runs won't have them.
