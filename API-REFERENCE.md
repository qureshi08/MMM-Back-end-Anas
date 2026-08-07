# Backend API Reference

The real, current contract for the MMM Platform backend. Everything in this document reflects what
is actually built and deployed as of August 7, 2026, not what is planned. Where something is not yet
built, it says so explicitly rather than being omitted.

## Base URLs

| Environment | URL |
|---|---|
| Shared Dev (live now, Render) | `https://mmm-back-end-anas.onrender.com/api/v1` |
| Local development | `http://localhost:3000/api/v1` |

This is Dev infrastructure, a stopgap on Render and Vercel until real Azure infrastructure exists
(App Service, Postgres Flexible Server), not a production deployment. See `PLATFORM.md` for the full
architecture picture.

Every route below is relative to one of these base URLs. All routes live under the `/api/v1` prefix,
there is no unprefixed API.

## Authentication

Every route requires a valid bearer token **except** `GET /health`. There is no API key or session
cookie mechanism, authentication is exclusively a Microsoft Entra ID access token.

- **Client ID:** `fa733969-d53d-46ed-81fc-119c740a5cc9`
- **Tenant ID:** `d5619769-1863-41fe-86e3-95000d84f2a6`
- **Scope:** `api://fa733969-d53d-46ed-81fc-119c740a5cc9/access_as_user`
- **Header:** `Authorization: Bearer <token>`

A request with no token, or a malformed/expired one, returns `401`. Dev bypass mode
(`AUTH_DEV_BYPASS`) is deliberately off on this shared Dev deployment, tokens must be real, same as
production will eventually require.

### First-login behavior

The first authenticated request from a given Microsoft account automatically creates a tenant and
user record if none exists yet, no invite or manual provisioning step is required. A company account
(`@convergentbt.com`) maps to one shared tenant for that organization. The first user provisioned
into a new tenant is given the `administrator` role automatically. This happens transparently, the
same request that returns real data is the one that provisions the account, there is no separate
signup call.

## Response conventions

### Success

Successful responses return the resource directly as JSON, no wrapper object (no `{ data: ... }`
envelope).

### Errors

Every error, regardless of cause, returns the same shape:

```json
{
  "statusCode": 404,
  "message": "Project 1f32fa3b-1fef-4b06-8fc0-1d8eeb35d0a3 not found.",
  "path": "/api/v1/projects/1f32fa3b-1fef-4b06-8fc0-1d8eeb35d0a3",
  "timestamp": "2026-08-07T10:18:26.902Z"
}
```

`message` is a string for most errors, but for request body validation failures it is an **array of
strings**, one per invalid field. Handle both shapes.

### Status codes actually in use

| Code | Meaning here |
|---|---|
| `200` | Success (GET, PATCH) |
| `201` | Resource created (POST), though `200` may also appear, treat both as success |
| `204` | Success, no body (DELETE) |
| `400` | Request validation failed, or a path parameter is not a valid UUID |
| `401` | Missing, malformed, or invalid/expired token |
| `403` | Authenticated, but not allowed to perform this action (ownership check) |
| `404` | Resource does not exist, or does not belong to your tenant |

Row-Level Security means a project belonging to another tenant returns `404`, not `403`, there is no
way to distinguish "does not exist" from "not yours" from the response, this is intentional.

## Endpoints

### `GET /health`

Public, no authentication required.

**Response, `200`:**
```json
{ "status": "ok", "database": "connected", "timestamp": "2026-08-07T10:18:07.469Z" }
```

### `GET /auth/me`

Returns what the token resolved to. Useful for confirming who is actually signed in and what
tenant/user record they mapped to, this is the endpoint to call to verify a real login actually
worked, not just that a popup closed.

**Response, `200`:**
```json
{
  "oid": "54f32ce6-...",
  "tid": "d5619769-1863-41fe-86e3-95000d84f2a6",
  "email": "amna@convergentbt.com",
  "name": "Amna Minhas",
  "devBypass": false,
  "tenantId": "74d65de7-719c-48c7-8618-dcd09639efc2",
  "userId": "6c423fb7-6fc1-494f-924c-73855a5b78a0"
}
```

`tenantId` and `userId` are your own platform-internal identifiers, generated on first login, not
anything from Entra. If this call ever returns a `401`, nothing else will work either, it is the
right first thing to check when debugging a connection issue.

### `POST /projects`

Creates a project owned by the signed-in user, in their own tenant.

**Request body:**
```json
{
  "name": "Q4 Brand Campaign",
  "description": "Optional, can be omitted entirely"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | string | yes | 1 to 200 characters |
| `description` | string | no | up to 2000 characters |

Any field not in this list is rejected with `400` (the API does not silently ignore unknown fields).
`status` cannot be set on create, every new project starts `"active"`.

**Response, `201`:** the full project object, see the data model below.

### `GET /projects`

Lists every project in the signed-in user's tenant. No pagination, filtering, or sorting parameters
exist yet, this returns the full list every time.

**Response, `200`:** an array of project objects, possibly empty (`[]`).

### `GET /projects/:id`

Returns one project by id.

- Malformed id (not a valid UUID) → `400`
- Well-formed id that does not exist, or belongs to another tenant → `404`
- Otherwise → `200` with the project object

### `PATCH /projects/:id`

Partial update. Only send the fields actually changing, omitted fields are left untouched (this was
a real bug earlier, sending an unrelated field used to null out others, it is fixed and covered by a
regression test).

**Request body**, any subset of:

| Field | Type | Constraints |
|---|---|---|
| `name` | string | 1 to 200 characters |
| `description` | string | up to 2000 characters |
| `status` | string | `"active"` or `"archived"` |

**Only the project's owner may update it.** Any other authenticated user, even in the same tenant,
gets `403` with message `"Only the project owner can do this."`

**Response, `200`:** the full, updated project object.

### `DELETE /projects/:id`

Soft delete. The row is not removed from the database, `deletedAt` is set. A deleted project no
longer appears in `GET /projects` and `GET /projects/:id` returns `404` for it afterward.

Same ownership rule as `PATCH`, non-owners get `403`.

**Response, `204`, no body.**

## Data model: Project

Exact shape of every project object returned by the API:

```json
{
  "id": "1f32fa3b-1fef-4b06-8fc0-1d8eeb35d0a3",
  "createdAt": "2026-08-06T11:51:35.322Z",
  "updatedAt": "2026-08-06T12:03:11.837Z",
  "tenantId": "c7d1d3f5-673f-428d-9f89-3125df7d4eb2",
  "name": "Q4 Brand Campaign",
  "description": "First real project",
  "ownerId": "6d3f500e-acaf-4f21-a9b5-30621a8f34bc",
  "status": "active",
  "deletedAt": null
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | |
| `createdAt` | string (ISO 8601) | |
| `updatedAt` | string (ISO 8601) | |
| `tenantId` | string (uuid) | Always the caller's own tenant |
| `name` | string | |
| `description` | string or `null` | |
| `ownerId` | string (uuid) | Matches a `userId` from `/auth/me` |
| `status` | `"active"` or `"archived"` | |
| `deletedAt` | string (ISO 8601) or `null` | Non-null only on a soft-deleted row, which you will not normally see since deleted rows are excluded from responses |

## What is not built yet

Do not build frontend code against these as if they exist. Calling them today returns `404`, route
not found, not `501` or any other signal that they are simply unfinished.

- Datasets (`/datasets`, upload, validation, Blob storage)
- Experiments (`/experiments`, run, results, logs)
- Jobs / job queue (`/jobs`, status polling)
- Notifications

`ProjectService`'s real endpoints are the only ones with a real backend behind them right now.
`DatasetService` and `ExperimentService` should stay on `useMockApi` until their real backend work
lands, pointing them at the live URL today will only produce `404`s, not useful data.

## Questions this document does not answer

If something about the actual request/response behavior is unclear or does not match what you
observe, do not guess, ask directly, this document is meant to be corrected the moment it drifts
from reality, not treated as permanently authoritative.
