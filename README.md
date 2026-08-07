# MMM Backend

NestJS backend for the MMM Platform. This service owns
tenancy, auth, projects/datasets/experiments metadata, and enqueuing model
runs. It never fits a model itself (see the system architecture diagram in
`../Resources/03-Architecture-and-Flow-Review/`).

See [PROTOCOL.md](./PROTOCOL.md) for how work on this codebase actually gets
built, verified, and logged. See [dev-log/for-anas/progress-log.html](./dev-log/for-anas/progress-log.html)
for what's currently done, blocked, or not started.

## Prerequisites

- Node.js 24.x, npm 11.x (`node --version`, `npm --version`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — for
  local Postgres. Not required once you're pointed at Azure.
- A Microsoft Entra ID app registration — only needed once you turn off
  `AUTH_DEV_BYPASS`. See [Auth setup](#auth-setup) below.

## First-time setup

```powershell
cd Backend
npm install
Copy-Item .env.example .env    # then open .env — the defaults work as-is for local Dev
docker compose up -d           # starts local Postgres on localhost:5432
npm run migration:run          # creates the tenants and users tables
npm run start:dev              # http://localhost:3000, restarts on save
```

Confirm it's alive:

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/health
```

`{"status":"ok","database":"connected", ...}` means the app is up and it can
actually reach Postgres — not just that the process started.

## Local Postgres → Azure Postgres, without touching code

Every `DB_*` value in `.env` is just config. Local Docker Postgres and Azure
Postgres Flexible Server are both "a Postgres reachable at `DB_HOST` with
these credentials, SSL on or off" — nothing in `src/` branches on which one
you're pointed at. Moving from one to the other is only ever a `.env` change:

| | Local (today) | Azure (later) |
|---|---|---|
| `DB_HOST` | `localhost` | `<name>.postgres.database.azure.com` |
| `DB_SSL` | `false` | `true` — Azure refuses plain connections |
| everything else | same shape | same shape |

Run `npm run migration:run` again once `.env` points at Azure, before the app
first talks to it — migrations are what actually creates the schema there.

## Two database roles, not one

`DB_USERNAME`/`DB_PASSWORD` is what the running app connects as — a
restricted role with no DDL rights. `DB_ADMIN_USERNAME`/`DB_ADMIN_PASSWORD`
is a separate, elevated role, used only by the migration CLI
(`data-source.ts`).

This isn't optional ceremony: Postgres exempts superusers from Row-Level
Security **unconditionally**, no matter what a policy says, and refuses to
ever demote the official Docker image's bootstrap user off superuser
(found this the hard way building `CMP-42`, 2026-08-05). If the app
connected as the same superuser migrations need, every RLS policy in this
codebase would silently do nothing. `.env.example`'s defaults already set
this up correctly (`mmm_dev` for admin, `mmm_app` for the app) — the app
role itself gets created by a migration
(`1785900000002-CreateAppRole.ts`), not by `docker-compose.yml`, so it
exists the first time you run `npm run migration:run`, not before.

## Auth setup

The API validates Microsoft Entra ID access tokens as a resource server —
see `src/modules/auth/`. Every route requires one **except** ones explicitly
marked `@Public()` (currently just `/health`).

**Before you have a real Entra app registration**, leave
`AUTH_DEV_BYPASS=true` in `.env`. Every request is then treated as an
authenticated fake dev user, so you can build and test everything else. The
app refuses to start with this flag on if `NODE_ENV=production` — it cannot
accidentally reach a deployed environment.

**Once you have one:**

1. Register an app in Entra ID for the API itself, expose an API (an
   `access_as_user` scope is the usual name), and note its Application ID URI.
2. Set `AZURE_AD_TENANT_ID` (a specific tenant GUID, or `common` if the
   registration is multi-tenant) and `AZURE_AD_AUDIENCE` (the Application ID
   URI from step 1) in `.env`.
3. Set `AUTH_DEV_BYPASS=false`.
4. In Postman, import both files from `postman/`, open the environment, and
   fill in `tenantId` / `clientId` / `scope`. On the collection's
   Authorization tab, click **Get New Access Token** — it opens a Microsoft
   sign-in popup and comes back with a real token.

`GET /auth/me` returns what the guard verified from the token, plus the
platform `tenantId`/`userId` it resolved to. As of `CMP-42` (2026-08-05),
that resolution is real: `TenantContextInterceptor` finds or creates the
matching `tenants`/`users` rows before any handler runs, using
`TenantResolutionService`. First-login signup is currently open (any real
Microsoft account, including personal ones, auto-provisions a tenant), an
early-stage decision meant to be revisited before general availability —
see that service's doc comment for the exact reasoning and what's still
genuinely undecided (how personal accounts should group, if at all).

## Project layout

```
src/
  main.ts                 bootstrap: global pipes, filters, CORS, /api/v1 prefix
  app.module.ts            wires config, database, and every feature module

  config/                  env validation + the one function that builds
                            TypeORM connection options (shared by the app
                            and the migration CLI, so they can't drift apart)

  database/
    data-source.ts          TypeORM CLI entry point (migration:generate/run/revert)
    migrations/             one file per schema change, hand-reviewed SQL

  common/                  cross-cutting code with no feature of its own
    entities/base.entity.ts   id/created_at/updated_at every table extends
    filters/                  the global exception filter
    tenant/tenant-context.ts  AsyncLocalStorage carrying the current
                               request's RLS-scoped QueryRunner — read this
                               before writing any tenant-scoped query

  modules/                 one folder per bounded feature, matching a table
                            (or small group of tables) in the schema doc
    health/
    auth/
    tenants/
    users/
```

**Adding the next module** (datasets, experiments, jobs, ...) follows the
same shape every time: `<name>.module.ts`, `<name>.service.ts`, an
`entities/` folder with one file per table, extending `common/entities/base.entity.ts`.
Write the migration by hand (see `1785772341863-InitialSchema.ts`) rather
than trusting `migration:generate` blindly — it's a good diff to read either
way, and hand-writing forces you to actually look at the constraints.

## Naming conventions

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Scripts

| Command | What it does |
|---|---|
| `npm run start:dev` | Run locally, restart on every save |
| `npm run build` | Compile to `dist/` |
| `npm run lint` | ESLint + Prettier, auto-fixing |
| `npm test` | Unit tests |
| `npm run migration:generate -- src/database/migrations/SomeName` | Diff entities against a **running** DB and draft a migration — always read the draft before keeping it |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:revert` | Roll back the last migration |
