# Platform architecture and deployment protocol

For the whole team, not just backend work. Written 2026-08-06, once a real
shared repo existed (`github.com/mirfarhanahmad/cbt-mmm-platform`) and more
than one project needed to fit into it.

**Where this file actually belongs:** the true repo root, once one exists
that both `backend/` and `frontend/` share (see Section 4). It lives in
`Backend/` for now only because that's the one local checkout this was
written from. Move it up once `main` exists.

## 1. The realistic options, and what's recommended

### Backend and database hosting

| Option | What it is | Real tradeoff |
|---|---|---|
| **Render** (recommended) | One dashboard, a Web Service plus a managed Postgres, auto-deploys straight from GitHub | Free tier spins the service down after inactivity, so the first request after idle takes 30-50 seconds to wake up. Free Postgres databases also have a limited lifetime before Render deletes them, confirm the exact window at signup and plan to upgrade or move off before it hits |
| Railway | Very similar developer experience to Render | No longer has a real free tier, usage-based billing starts from day one, a small but real cost |
| Fly.io | More power, genuine long-running containers, full control | Real operational overhead: its own CLI, config file, and manual Postgres cluster setup. More than this team needs for a Dev environment right now, worth knowing about for later |
| Someone's own laptop plus a tunnel (ngrok, Cloudflare Tunnel) | Free, no new accounts | This is exactly the "not everyone's on the same internet" problem the whole shared-environment effort exists to avoid, only works while that one laptop is on |

**Recommendation: Render.** Already fully specced, click by click, in
`dev-log/for-anas/deployment-guide.html`. Simplest path, matches the
team's current infrastructure experience.

### Frontend hosting

| Option | What it is | Real tradeoff |
|---|---|---|
| **Vercel** (recommended) | Zero-config deploys for Angular, free tier, an automatic preview URL for every branch and PR | None significant at this stage |
| Netlify | Near-identical positioning to Vercel for a static/SPA frontend | No real reason to pick it over Vercel unless the team already has a preference |
| Azure Static Web Apps | Skips a "temporary" tool, since Azure is the real eventual destination | Blocked, no Azure subscription exists yet, same organizational blocker as the rest of the Azure work |

**Recommendation: Vercel**, matching what was already asked for.

### Auth, specifically for the first live connection

Don't wire up real Microsoft login on the frontend before the very first
end-to-end test. Set the shared Render backend's `AUTH_DEV_BYPASS=true`
for this first pass, a fake but consistent identity on both sides, and
prove the wiring itself works before adding a second moving part
(MSAL). Real frontend login is genuine work, see Section 3, don't let it
block "can we see data move through the whole stack at all."

## 2. The fastest realistic path to seeing it live

Don't wait on the `main`/monorepo decision in Section 4 to see this work,
that's real but separate. Deploy from the branches that already exist:

1. Render: deploy from `backend/anas`, exactly as written up in
   `deployment-guide.html`, with `AUTH_DEV_BYPASS=true`.
2. Amna adds `environment.prod.ts` and an `angular.json` `fileReplacements`
   entry (see Section 3), points `apiBaseUrl` at the live Render URL, and
   sets `useMockApi: false`.
3. Vercel: deploy from `frontend`, root directory as-is, no monorepo
   restructuring needed for this step.
4. Open the Vercel URL, use the app, and watch a real action (creating a
   project, say) actually land in the shared Render Postgres.

That's genuinely the whole app, live, in Dev mode. Everything else in
this document, real login, the `main` branch, eventually Azure, is real
work, but none of it has to happen before this.

## 3. Connecting frontend to backend, the actual mechanics

### The API now has a version prefix

Found while writing this document: the frontend's `environment.ts`
already expected `apiBaseUrl` to end in `/api/v1` (e.g. calls
`${apiBaseUrl}/projects`), but the NestJS backend had no such prefix,
routes were just `/projects`. That would have broken the moment anyone
wired the two together. Fixed on the backend side, 2026-08-06
(`app.setGlobalPrefix('api/v1')` in `src/main.ts`), verified with real
`curl` calls before and after. The frontend's existing code didn't need
to change, it already assumed the prefix that now actually exists.

### Base URL, and a real gap on the frontend side

The frontend already has the right shape for this,
`src/environments/environment.ts`:

```ts
export const environment = {
  production: false,
  useMockApi: true,
  apiBaseUrl: 'http://localhost:3000/api/v1',
};
```

Every service (`ProjectService`, `DatasetService`, ...) already branches
on `useMockApi` and has the real `HttpClient` call written right next to
the mock one. That part is ready.

**What's missing:** `angular.json`'s `production` build configuration has
no `fileReplacements` entry, and there's no `environment.prod.ts` file at
all. That means a production build today still bundles the exact same
`environment.ts`, `useMockApi: true` and a `localhost` URL, regardless of
where it's actually deployed. This needs to be built before a Vercel
deploy is useful for testing against a real backend, and it's the
frontend side's action item, not something to guess at from here:

1. Add `src/environments/environment.prod.ts`, same shape,
   `useMockApi: false`, `apiBaseUrl` set to the real Render URL.
2. Add a `fileReplacements` entry to `angular.json`'s `production`
   configuration, swapping `environment.ts` for `environment.prod.ts`.

### CORS

Already wide open on the backend (`app.enableCors()` in `main.ts`), no
action needed to get a first connection working. Worth tightening to the
real Vercel origin once that URL is stable, that's a one-line change when
it's time, already flagged in `main.ts`'s own comment.

### Auth, once real login (not dev-bypass) is needed on the frontend too

The frontend needs its own sign-in flow, `@azure/msal-angular` is the
standard library for this in an Angular app. It can reuse the same Entra
app registration the backend already validates tokens against (Client ID
`fa733969-d53d-46ed-81fc-119c740a5cc9`, Tenant ID
`d5619769-1863-41fe-86e3-95000d84f2a6`, both from `Backend/.env`),
Authorization Code + PKCE, same as how Postman gets a token today, no
client secret involved.

**One real action item:** that app registration's Redirect URIs currently
only cover Postman's own callback. Once Amna has a stable frontend URL
(a Vercel deployment URL, or `localhost:4200` for her own local dev),
Anas needs to add it as a new Redirect URI in that Entra app
registration, he's the one who registered it and has access. Don't assume
sign-in will just work from a new origin without this step.

## 4. Open question, needs Farhan and Amna, not just Anas

Checked both branches directly before writing anything else here:
`backend/anas` has the NestJS project at the repo root (`package.json`,
`src/` right at top). `frontend` has the Angular project at the repo root
the exact same way (`angular.json`, `src/app/` right at top). Two
different projects both claiming to be "everything at the root" can't
merge into one shared `main` as they are, GitHub has no way to combine
two different root layouts into one tree.

**Recommended fix:** a real monorepo, `main` containing `backend/` and
`frontend/` as subfolders, each project's own files moved one level down
into its folder. Whoever's branch merges into `main` first does that move
as part of the merge, and the other person's next merge lands cleanly
into its own folder from then on.

This is a call for the team to actually make, especially Farhan since he
owns the repo. Don't create `main` by just pushing one project's current
flat layout and hoping the other side works around it, that's the same
problem one merge later. Raise it directly rather than each person
guessing at a fix independently. This does not block Section 2's live
demo, it only matters once real ongoing PR-based collaboration starts.

## 5. Architecture, the pieces and where they run

```
Angular SPA  --HTTPS-->  NestJS API  --Postgres wire protocol-->  Postgres
(Vercel)                 (Render)                                 (Render)
```

Later: a Python modeling worker (Meridian or PyMC-Marketing, not yet
built) sits behind the API for anything that takes minutes to hours to
run, talking to it through a job queue, not a direct HTTP call. Eventually
all of this moves to Azure (App Service, Postgres Flexible Server,
Container Apps for the worker), Render and Vercel are the Dev-only
stopgap until that infrastructure exists. See the Azure folder's
`project-context.md` for that side.

## 6. Deploying the backend, Render

Full click-by-click steps already written:
`dev-log/for-anas/deployment-guide.html`. One update once `main` exists:
point the Render service at `main`, not a personal branch, so the shared
Dev backend reflects reviewed, merged work rather than one person's
in-progress branch. Until `main` exists, deploying from `backend/anas` is
a reasonable stopgap (see Section 2), just know it'll need re-pointing
later.

## 7. Deploying the frontend, Vercel

1. Sign up at `vercel.com`, connect with GitHub, same consideration as
   Render: a personal account is a fine Dev-only stopgap, migrate to a
   real team account before this matters for anything beyond testing.
2. **New Project** → import `cbt-mmm-platform` → Vercel needs to know
   which folder actually holds the Angular app. Until the monorepo
   question in Section 4 is resolved, this points at whichever branch has
   Angular at its root (`frontend` today). Once `main` exists with a
   `frontend/` subfolder, set Vercel's **Root Directory** to `frontend`
   instead.
3. Vercel auto-detects Angular and fills in the build command
   (`ng build`) and output directory. Confirm rather than assume, Angular
   CLI versions occasionally change the default output path.
4. Every push gets its own preview URL automatically, that's a Vercel
   default, not something to configure. Pick one branch (`main`, once it
   exists) as the one whose deployment is "the shared frontend" everyone
   points at, same idea as the single shared Render backend.
5. Angular's environment values are baked in at build time (see Section
   3's gap), not read from Vercel's dashboard environment variables the
   way Render reads `.env`-style vars for the backend. Don't set
   `apiBaseUrl` as a Vercel env var expecting it to work, it won't, until
   `environment.prod.ts` exists and the build actually uses it.

## 8. Testing a feature that spans both sides

Point the shared Vercel frontend at the shared Render backend's public
URL (via `environment.prod.ts`, see Section 3), and test there. Don't
combine "my local frontend" with "someone else's local backend" or
similar mixed setups, that needs matching network access and correct
local config on both sides at the same time, which is exactly what the
shared Dev environment exists to avoid.

## 9. Open items, by owner

- **Farhan**: decide the monorepo restructuring with the team, create
  `main` once agreed, set it as the repo's default branch.
- **Amna**: add `environment.prod.ts` + `angular.json` `fileReplacements`;
  deploy to Vercel once that exists; tell Anas her frontend's real URL.
- **Anas**: finish the actual Render deploy (guide already written, not
  yet executed); add Amna's frontend URL as a Redirect URI in the Entra
  app registration once she has one.
