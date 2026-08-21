# Prompt for Amna's Claude — projects are invite-only now, real project members

Copy everything below into Amna's Claude Code session. Real change, shipped today: projects are no
longer automatically visible to everyone on the team.

## What changed

- `GET /projects` now only returns projects you actually have access to: ones you own, ones a
  Master or the owner added you to, or every project if you're a Master yourself. It used to
  return every project in the whole team regardless of role.
- `GET /projects/:id` returns a real `404` (not `403`) if you don't have access — deliberately,
  so a private project doesn't even confirm it exists to someone not on it.
- Every dataset endpoint under a project now enforces the same check. Nobody's existing access to
  a project they were already looking at should have changed today (existing team members were
  grandfathered into every existing project), but any *new* project created from now on is
  invite-only from the moment it's created — only its owner (and Masters) can see it until someone
  is explicitly added.

## New endpoints — project members

- **`GET /projects/:id/members`** — real members with access to this project (their real user
  objects: name, email, `globalRole`). Available to anyone who can already see the project.
- **`POST /projects/:id/members`** — body `{ "email": "..." }`. Adds an existing tenant member to
  this project. Master or the project's owner only, real `403` for anyone else. Real `400` if the
  email isn't an existing team member yet (tell them to invite via Settings first) or already has
  access.
- **`DELETE /projects/:id/members/:userId`** — removes someone's access to this project. Master or
  owner only. Real `400` if you try to remove the project's own owner.

No role field on any of these — being added to a project only grants visibility. What someone can
*do* inside it (view only vs. create/edit/train/delete) still comes from their existing tenant-wide
role (Master/Read/Read-Write), same as everywhere else.

## UI suggestion

On a project's detail page (wherever it makes sense in the current layout), show who has access
and let the owner/a Master add or remove someone — same shape as the Members section already built
for Settings, just scoped to one project instead of the whole tenant. Non-owners/non-Masters
shouldn't see add/remove controls, only the member list.

## Also new: real "model owner" per dataset

Every dataset object (`GET /projects/:id/datasets`, `GET /datasets/:id`) now includes
`createdByUserId` — the real user ID of whoever uploaded that specific dataset. If you're already
showing member names elsewhere, resolve it against the project's member list; otherwise a plain
"Uploaded by [name]" next to the dataset's name/date is enough. Existing datasets were backfilled
with the project owner's ID as the closest real fact available for data that predates this field.
