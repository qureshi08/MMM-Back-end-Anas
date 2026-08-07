# Naming and structure conventions

Four of us will touch this codebase. These rules exist so a file's name and
location tell you what's in it before you open it, consistently, whoever
wrote it.

## Files

| Kind | Pattern | Example |
|---|---|---|
| Module | `<name>.module.ts` | `tenants.module.ts` |
| Service | `<name>.service.ts` | `users.service.ts` |
| Controller | `<name>.controller.ts` | `auth.controller.ts` |
| Entity | `entities/<singular-name>.entity.ts` | `entities/tenant.entity.ts` |
| Guard | `guards/<name>.guard.ts` | `guards/entra-auth.guard.ts` |
| Decorator | `decorators/<name>.decorator.ts` | `decorators/public.decorator.ts` |
| Test | same name as the file it tests, `.spec.ts` | `entra-jwt.verifier.spec.ts` |
| Migration | `<epoch-ms>-<PascalCaseName>.ts` | `1785772341863-InitialSchema.ts` |

All file names are kebab-case. No exceptions for a file that "is basically
one class" — the class inside is PascalCase, the file on disk is kebab-case,
always.

## Code

- **Classes, interfaces, enums, decorators:** PascalCase — `TenantsService`,
  `AuthenticatedUser`, `GlobalRole`.
- **Variables, functions, methods:** camelCase.
- **Entity columns:** the TypeScript property is camelCase
  (`globalRole`), the actual Postgres column is snake_case
  (`@Column({ name: 'global_role' })`). This isn't a style preference — it's
  what makes the property names match every other NestJS/TypeScript codebase
  while the column names match the schema doc and the ERD exactly. Never let
  these drift; a migration and its entity disagreeing about a column name is
  a bug that only shows up at runtime.
- **Environment variables:** `SCREAMING_SNAKE_CASE`, and every single one is
  declared in `src/config/env.validation.ts`. If the app reads
  `process.env.SOMETHING` anywhere else, that's a bug — it means a typo in
  that name fails silently instead of refusing to boot.

## One module per bounded feature

A module folder under `src/modules/` corresponds to one table, or a small
tightly-coupled group of tables from the schema doc — not one per
controller endpoint, not one giant module for everything. `auth/` needs
`users/` (to eventually resolve a token to a local user) but doesn't own the
`users` table itself; it imports `UsersModule` and calls its service. Follow
that shape: own your table, expose a service, import what you need from
elsewhere.

## Migrations are reviewed SQL, not a generated artifact you trust blindly

`migration:generate` is a genuinely useful starting point — it diffs your
entities against a running database — but the output goes in a pull request
like anything else. Read it. A generated migration that silently drops a
column because an entity's property got renamed is a very easy way to lose
data, and it happens by looking like nothing unusual in a diff if nobody
reads it.

## Commits

Not enforced by tooling yet, but the convention going forward:

```
<type>(<module>): <what changed, present tense>

feat(auth): validate Entra tokens as a resource server
fix(users): scope the email uniqueness check to tenant_id
chore(deps): bump typeorm to 1.1.0
```

`type` is one of `feat`, `fix`, `chore`, `docs`, `test`, `refactor`.
`<module>` matches a folder under `src/modules/`, or `config`/`database` for
cross-cutting changes.
