# Deployment

Target architecture:

```
              GitHub
             /      \
    Angular repo    ammam (this repo)
         │                │
         ▼                ▼
   GitHub Pages     Container host          Supabase
   (static)         (Render / Railway /  ──▶ PostgreSQL
                     Fly.io / Cloud Run)     project qvyhsdvlgkfzwsjotiwp
```

GitHub Pages serves static files only — it cannot run NestJS. The API must be deployed to a
platform that runs containers or Node processes.

---

## 1. Database: Supabase

The database is the Supabase project **`qvyhsdvlgkfzwsjotiwp`**.

### Two connection strings, not one

Prisma needs both, and they are not interchangeable:

| Variable | Supabase connection | Port | Used for |
| --- | --- | --- | --- |
| `DIRECT_URL` | Direct (`db.<ref>.supabase.co`) or Session pooler | 5432 | `prisma migrate deploy`, `prisma db push` |
| `DATABASE_URL` | Transaction pooler (`...pooler.supabase.com`) | 6543 | Every runtime query |

Migrations **must not** run through the transaction pooler: PgBouncer in transaction mode
cannot hold the session-level advisory locks Prisma Migrate takes out, and the migration
will hang or fail. That is why `prisma/schema.prisma` declares `directUrl`.

The connection string from the dashboard is the direct one:

```
postgresql://postgres:[YOUR-PASSWORD]@db.qvyhsdvlgkfzwsjotiwp.supabase.co:5432/postgres
```

Use it for `DIRECT_URL`, adding `?sslmode=require`. For `DATABASE_URL`, take the transaction
pooler string from **Project Settings → Database → Connection pooling** and append
`?pgbouncer=true&connection_limit=1&sslmode=require`.

`pgbouncer=true` is not optional — without it Prisma issues prepared statements the
transaction pooler cannot support, and queries fail intermittently under load.

> **IPv4 warning.** On newer Supabase projects the direct host
> (`db.<ref>.supabase.co`) resolves to IPv6 only. If your container host is IPv4-only,
> direct connections will fail with a timeout that looks like a firewall problem. In that
> case use the **session pooler** (also port 5432, on `pooler.supabase.com`) for
> `DIRECT_URL` — it is IPv4-reachable and still session-mode, so migrations work.

### What the publishable key is not

`sb_publishable_...` (and the older `anon` / `service_role` keys) authenticate browser
clients against Supabase's PostgREST, Auth and Storage APIs. **This backend uses none of
them** — it connects straight to Postgres with Prisma and issues its own JWTs. The key
belongs in no variable in this project. Do not put it in `DATABASE_URL`, and do not ship it
to the Angular app for this API's sake.

### Supabase CLI — optional, and a caution

```bash
supabase login
supabase init
supabase link --project-ref qvyhsdvlgkfzwsjotiwp
```

This is useful for pulling connection details and for local Studio access. But **do not use
`supabase db push` or `supabase migration` on this project.** Prisma Migrate owns the
schema; running Supabase's migration tooling alongside it gives you two systems writing to
the same database with separate migration histories, which diverge silently.

If you do run `supabase init`, add `supabase/` to `.gitignore` or keep only the config file,
so the CLI's migration directory never becomes a second source of truth.

### Row Level Security

Supabase enables RLS by default on tables created through its dashboard. Tables created by
Prisma Migrate have RLS **off**, which is correct here: this API is the only client, it
connects as the `postgres` role, and it enforces authorisation in the application layer.

Leaving RLS off means any holder of the database password has full access — so the password
is the boundary. Never expose it, and never point a browser client at this database using
the publishable key expecting RLS to protect these tables.

---

## 2. First deployment

### a. Apply the schema

From a machine that can reach Supabase, with `DIRECT_URL` and `DATABASE_URL` set:

```bash
yarn install
yarn prisma:generate
yarn prisma:deploy      # prisma migrate deploy
```

`migrate deploy` only applies migrations already committed in `prisma/migrations/`. It never
generates one and never resets.

**Never run `prisma migrate dev` against production** — it can reset the database.

### b. Import the profile data

Once only, for a fresh database:

```bash
ADMIN_EMAIL='you@example.com' ADMIN_PASSWORD='<a strong password>' yarn db:seed
```

This imports the vendored Angular snapshot from `prisma/data/` and creates the admin
account. It is idempotent — re-running updates rows in place rather than duplicating — but
it also **overwrites admin edits** for any row still present in the snapshot. After go-live,
treat the seed as a recovery tool, not a routine step.

Verify:

```bash
curl -s https://<your-backend-domain>/api/v1/public/tenants/albaz/profile | head -c 400
```

### c. Deploy the container

```bash
docker build -t profile-api .
docker run -p 3000:3000 --env-file .env profile-api
```

On a managed platform, point it at this repo's `Dockerfile` and set the environment
variables below. The image runs as a non-root user and has a `HEALTHCHECK` that hits
`/api/v1/health`, which includes a real database round-trip — configure the platform's own
health check to use the same path.

---

## 3. Environment variables in production

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | `production` |
| `DATABASE_URL` | yes | Supabase transaction pooler, `pgbouncer=true` |
| `DIRECT_URL` | yes | Supabase direct/session connection (migrations) |
| `JWT_SECRET` | yes | ≥ 32 chars, `openssl rand -base64 48`. Not Supabase's JWT secret. |
| `CORS_ORIGINS` | yes | `https://aelbazz.github.io` — origin only, no path, no `*` |
| `PORT` | usually | Most platforms inject it |
| `JWT_EXPIRES_IN` | no | Default `7d` |
| `THROTTLE_LIMIT` / `THROTTLE_TTL_SECONDS` | no | Defaults `120` / `60` |
| `AUTH_THROTTLE_LIMIT` | no | Default `5` |
| `SWAGGER_ENABLED` | no | Defaults **off** in production; set `true` to expose `/api/docs` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | seed only | The default tenant's Client login. Not needed at runtime. |
| `PLATFORM_ADMIN_EMAIL` / `_PASSWORD` | seed only | Bootstraps the first `Role.ADMIN` - there is no API to create one otherwise. |

The app validates all of these at startup and refuses to boot on a bad value, including a
`JWT_SECRET` under 32 characters or a `*` in `CORS_ORIGINS` while `NODE_ENV=production`.

---

## 4. GitHub Actions secrets

`.github/workflows/deploy.yml` needs these in **Settings → Secrets and variables → Actions**
(the `production` environment):

| Secret | Purpose | Required |
| --- | --- | --- |
| `DATABASE_URL` | Runtime connection, for the migrate job | yes |
| `DIRECT_URL` | Direct connection, used by `migrate deploy` | yes |
| `ADMIN_EMAIL` | Seed only | only if running the opt-in seed |
| `ADMIN_PASSWORD` | Seed only | only if running the opt-in seed |
| `PLATFORM_ADMIN_EMAIL` | Seed only | bootstraps the first platform Admin |
| `PLATFORM_ADMIN_PASSWORD` | Seed only | bootstraps the first platform Admin |
| `DEPLOY_HOOK_URL` | Your host's deploy webhook | optional |
| `PRODUCTION_URL` | Base URL for the post-deploy health check | optional |

`GITHUB_TOKEN` is provided automatically and is used to push the image to ghcr.io.

The seed step is **opt-in** — it runs only via `workflow_dispatch` with `run_seed: true`, so
an ordinary push can never overwrite live content.

The final step polls `/api/v1/health` and **fails the workflow** if the new revision never
reports healthy. A green deploy job therefore means the instance actually answered; if that
secret is unset, the step is skipped and the workflow makes no claim about the deployment.

---

## 5. Ongoing schema changes

```bash
# locally, against docker compose
yarn prisma:migrate --name add_something   # generates prisma/migrations/<ts>_add_something
yarn test && yarn test:e2e
git add prisma/migrations && git commit
```

CI runs the migration against a throwaway Postgres, seeds it and runs the full e2e suite
before the deploy workflow applies it to Supabase.

Migrations are forward-only. To undo one, write a new migration that reverses it — never
edit or delete a migration that has already been applied.

---

## 6. Refreshing the seed snapshot

When the Angular static data changes and you want it reflected in the database:

```bash
./scripts/sync-frontend-data.sh ../myProfile
git diff prisma/data          # review before trusting it
yarn db:seed                  # locally first
```

---

## 7. Deployment is not verified until it is checked

Nothing in this document confirms your deployment works. After deploying, confirm:

```bash
curl -fsS https://<your-backend-domain>/api/v1/health
curl -fsS https://<your-backend-domain>/api/v1/public/tenants/albaz/profile | head -c 200
curl -si  https://<your-backend-domain>/api/v1/public/tenants/albaz/profile \
  -H 'Origin: https://aelbazz.github.io' | grep -i access-control-allow-origin
```

The third one matters most: a missing CORS header is the failure mode that looks like a
broken frontend rather than a misconfigured backend.
