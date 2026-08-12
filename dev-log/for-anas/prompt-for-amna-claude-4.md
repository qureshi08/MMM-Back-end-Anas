# Prompt for Amna's Claude — follow-up (real global nav, real model names, delete)

Copy everything below into Amna's Claude Code session, in her frontend repo (`mmm-frontend-amna`).
Follows `prompt-for-amna-claude-3.md`. The Models list and the disabled Train Model / "Setup
complete" screen from that prompt are built and look right. Two things are still off after actually
using it end to end.

---

## 1. Still no real way out of a model's build screens

The Upload Data / Configure / Optimize / Calibrate / Hyperparameterization flow has a "← Back"
button, top left, on every screen. That only steps back one level (or to the models list, unclear
which). Compare to Cassandra: its left sidebar (Dashboard, Models, Budget Allocator, Incrementality
Experiments, Data Sources) is visible on literally every screen, at any depth, model-build screens
included. A single "Back" button isn't that, it still feels like being inside one flow with no true
exit.

**Build:** a persistent nav element (top bar or left rail, whichever fits the existing layout better)
present on every screen in the app, not just the top-level ones: a link back to **Projects**, a link
to **this project's Models list**, and **Sign out**. It should look and behave identically whether
you're on the Models list or four screens deep in Hyperparameterization. Don't make it something that
has to be re-added per screen, build it once as a real layout wrapper.

## 2. Models are named after the raw filename, not a real model name

The Models list shows rows like `sample-mmm-dataset (3).csv` and `sample-mmm-dataset (1).csv` twice.
That's the uploaded file's name, not something a person chose to call the model. Cassandra shows
`Model Name: Anas`, a real, separate, human-chosen name.

**Build:** add a real "Model Name" field to the Upload Data screen (separate from the file being
uploaded), and use that for the Models list display, not the filename. The backend's
`POST /projects/:projectId/datasets` already accepts a `name` field for exactly this — it's currently
being sent as the filename by default, change that to a real text input the user fills in
("Q4 Brand Campaign Model," not "sample-mmm-dataset (3).csv").

## 3. No way to delete test/junk rows

Six rows on that Models list, most of them leftover test uploads with no way to remove them. This
compounds problem 2, a cluttered list with no real names and no cleanup reads as unfinished, not "in
progress."

**Build:** a delete action per row (icon or menu, your call on placement) calling the real, already-
built `DELETE /datasets/:id` — no backend work needed, it exists, does a real soft delete, and the
list's own `GET /projects/:projectId/datasets` already excludes deleted rows automatically. Add a
confirm step before deleting ("Delete this model? This can't be undone from the screen.") since
there's no undo in the UI even though the backend keeps the row for audit.
