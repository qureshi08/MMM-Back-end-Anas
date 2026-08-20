# Prompt for Amna's Claude — real Members, real invites, real notification preferences

Copy everything below into Amna's Claude Code session, in her frontend repo. The Settings page's
Members and Notifications sections can now be wired to real endpoints instead of mock UI.

## 1. Real members list — replaces "isn't connected to a backend yet"

**`GET /members`** — no body. Returns the real tenant members:

```json
[
  {
    "id": "uuid",
    "email": "amna.minhas@convergentbt.com",
    "firstName": "Amna",
    "lastName": "Minhas",
    "globalRole": "administrator",
    "createdAt": "2026-08-04T10:00:00.000Z"
  }
]
```

`globalRole` is one of: `marketing_analyst`, `marketing_manager`, `data_scientist`,
`administrator`. Show it as a real label (e.g. "Administrator", "Marketing Analyst"), and if the
signed-in user is an administrator, show real **role-change** and **remove** controls per row.

## 2. Real invite — a real button, a real email

**`POST /members/invite`** — body `{ "email": "...", "role": "marketing_analyst" }`. Admin-only,
returns `403` for anyone else — show whatever error message comes back. On success, a real email
goes out through Microsoft Graph, and the invited role is applied automatically the moment that
person actually signs in (nothing else needs to happen on their end besides signing in with their
Microsoft account, same as today).

**`GET /members/invites`** — real pending invites (not yet accepted):

```json
[{ "id": "uuid", "email": "...", "role": "...", "invitedAt": "...", "acceptedAt": null }]
```

Show these in the Members list too, clearly marked "Invited, not joined yet" — don't mix them into
the real-member list silently.

## 3. Role change and remove — admin only

- **`PATCH /members/:id/role`** — body `{ "role": "..." }`. Returns the updated real member.
- **`DELETE /members/:id`** — `204` on success. Can't remove yourself, real `400` if you try.

Both `403` for a non-admin, with whatever message the backend sends.

## 4. Real notification preferences

**`GET /me/notification-preferences`** → `{ "runCompleted": true, "runFailed": true, "weeklyDigest": false }`
**`PATCH /me/notification-preferences`** — send only the toggle that changed, e.g.
`{ "runCompleted": false }`, returns the full updated real object.

Wire the three existing checkboxes to these — load real values on page open, save on toggle.

## 5. Real emails now actually get sent on Train Model completion/failure

No new endpoint for this one — it already happens automatically once `runCompleted`/`runFailed` is
true for whoever clicked Train Model. Nothing to build here, just worth knowing it's real now, in
case anyone asks why they got an email.

## 6. Subscription section — leave it, just label it honestly

Don't build real Marketplace billing yet, that's a separate, bigger project. Just add the same kind
of honest label Members already had ("isn't connected to a backend yet") under Subscription, so it
doesn't look like real billing data when it isn't.
