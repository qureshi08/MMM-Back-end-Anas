# Prompt for Amna's Claude — role system replaced, 4 job titles -> 3 real permission tiers

Copy everything below into Amna's Claude Code session. This is a real breaking change on the
backend, shipped today — any UI still sending or expecting the old role values will fail.

## What changed

The 4 marketing-titled roles (`marketing_analyst`, `marketing_manager`, `data_scientist`,
`administrator`) are gone. Replaced with 3 real permission tiers that actually control what a
member can do, not just a label:

| Old value | New value | Real meaning |
|---|---|---|
| `administrator` | `master` | Can do anything — manage members (invite/role-change/remove) *and* create/edit/train/delete projects and datasets. |
| (n/a, new) | `read` | Can view everything — projects, datasets, training results — but cannot create, edit, train, or delete anything. Cannot manage members. |
| `marketing_analyst` / `marketing_manager` / `data_scientist` | `read_write` | Can view everything and create/edit/train/delete projects and datasets. Cannot manage members. |

Show these as **"Master"**, **"Read"**, **"Read/Write"** anywhere a role is displayed or picked —
in the member list, the invite form's role dropdown, and the per-member role-change dropdown.

## What breaks if this isn't updated

- `GET /members` and `GET /members/invites` now return `globalRole`/`role` as `master` / `read` /
  `read_write`. Any UI mapping the old 4 values to display labels will show a blank or wrong label
  for these.
- `POST /members/invite` and `PATCH /members/:id/role` now **reject** the old role values with a
  `400` (they only accept `master` / `read` / `read_write`). If the invite form's dropdown still
  sends `marketing_analyst`, every invite will fail.

## Also real now, not new but worth confirming

- `POST /projects`, `PATCH /projects/:id`, `DELETE /projects/:id`, and every mutating dataset
  endpoint (create, configure, optimize, calibrate, hyperparameters, combine-channels,
  auto-combine-channels, assemble, train, delete) now return a real `403` for anyone with the
  `read` role. Show that error message as-is if it comes back — it means the signed-in member
  genuinely doesn't have write access, not a bug.
- Existing real members were migrated automatically, nobody lost access: every current
  Administrator became Master, everyone else became Read/Write. Nobody is silently downgraded to
  Read — that only happens if a Master explicitly changes someone's role in the UI.
