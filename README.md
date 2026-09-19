# Profile API

NestJS + Prisma + PostgreSQL backend for the Angular profile/portfolio site — a **multi-tenant
SaaS platform**. One deployment hosts many people's portfolios ("tenants"), each with its own
control panel, fully isolated from the others, managed under three roles: platform **Admin**,
**Coordinator**, and **Client** (the person who owns a tenant's profile content).

```
                       Angular (public site + Client control panel)
                                        │
                                    HTTPS REST
                                        │
                                  NestJS REST API
                                        │
                              ┌─────────┼─────────┐
                              │         │         │
                          PostgreSQL  Auth/RBAC  Billing
```

The Angular public site calls **one** endpoint per tenant —
`GET /api/v1/public/tenants/:tenantSlug/profile` — instead of loading nine static JSON files.

## Documentation

| Document | What it covers |
| --- | --- |
| [`docs/SAAS-ARCHITECTURE.md`](docs/SAAS-ARCHITECTURE.md) | Personas, the Tenant/RBAC model, isolation guarantees, billing, slug rules, audit logging. **Read this first** for the platform layer. |
| [`docs/MIGRATION-MAPPING.md`](docs/MIGRATION-MAPPING.md) | Field-by-field mapping from the original Angular models to Prisma — the profile domain underneath every tenant. |
| [`docs/ANGULAR-INTEGRATION.md`](docs/ANGULAR-INTEGRATION.md) | How the frontend consumes this API. |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Production deployment, migrations, required secrets. |
| `/api/docs` | Swagger UI (on by default outside production). |

---

## Quick start

```bash
cp .env.example .env          # edit JWT_SECRET and the seed credentials below
yarn install
docker compose up -d          # local PostgreSQL on :5432
yarn prisma:generate
yarn prisma:migrate           # creates the schema
yarn db:seed                  # imports the Angular data as the "default" tenant
yarn start:dev
```

- API: <http://localhost:3000/api/v1>
- Swagger: <http://localhost:3000/api/docs>
- Health: <http://localhost:3000/api/v1/health>
- Public profile: <http://localhost:3000/api/v1/public/tenants/albaz/profile>

---

## Personas and permissions

| Capability | Admin | Coordinator | Client |
| --- | :---: | :---: | :---: |
| Create a tenant | yes | yes (self-assigned) | no |
| View every tenant | yes | no | no |
| View assigned tenants | yes | yes | — |
| View/manage own tenant's profile | yes | assigned tenants | yes |
| Change tenant status (suspend/activate/archive) | yes | no | no |
| Reassign a tenant's coordinator | yes | no | no |
| Manage billing (plans/subscriptions/payments) | yes | no | read-only, own tenant |
| Create coordinators/admins | yes | no | no |

Full reasoning, the isolation guarantees, and why `Tenant.coordinatorId` was chosen over a
membership join table: [`docs/SAAS-ARCHITECTURE.md`](docs/SAAS-ARCHITECTURE.md).

**The tenant is never client-supplied.** It is resolved from the database during JWT
validation, so a Client cannot name another tenant in a URL or body, and a Coordinator sees
only tenants where `Tenant.coordinatorId` actually points at them.

---

## The data import

The seed is a **migration, not a fixture generator**. Every value for the `default` tenant
comes from the real Angular data in `prisma/data/` (vendored via
`./scripts/sync-frontend-data.sh`); nothing is invented.

```
myProfile/public/assets/data/*.json → prisma/data/*.json → yarn db:seed → PostgreSQL
```

A run reports exactly what it imported:

```
  tenant            1  (default)
  person            1  (Ahmed Mohsen Albaz)
  subscription      1  (Free / ACTIVE)
  tenant_theme      1  (defaults)
  website_settings  1  (defaults)
  contact           1  (+4 social links)
  technology       57  (deduplicated from 130 references)
  experience        9  (+51 responsibilities, +27 achievements, +61 technology links)
  project          16  (+64 highlights, +69 technology links)
  achievement      10
  course           27  (+147 course skills)
  timeline_event   18
  mgmt_role         3  (+17 responsibilities, +12 achievements)
  skill_category   14  (+117 skills)
  user (CLIENT)     1  (credentials from SEED_CLIENT_EMAIL/PASSWORD, falls back to ADMIN_EMAIL/PASSWORD)
  user (ADMIN)      1  (credentials from PLATFORM_ADMIN_EMAIL/PASSWORD, skipped if unset)
  user (COORDINATOR) 1  (credentials from SEED_COORDINATOR_EMAIL/PASSWORD, skipped if unset)
```

Idempotent — upserts on `tenant.slug`, `(personId, legacyId)`, `(personId, technology.slug)`
and each account's email, so re-running updates in place. The seed targets one tenant
("default"); create additional tenants through the API
(`POST /admin/tenants` or `POST /coordinator/tenants`) once an Admin or Coordinator account
exists — there is no standalone tenant-creation script, so the onboarding transaction has
exactly one implementation to stay correct.

### Technology de-duplication

There is no `technology.json`; the table is derived from names referenced inline by
experiences and projects, matched on a normalised slug so `Node.js` / `NodeJS` / `node js`
collapse to one row **per tenant** — technologies are tenant-owned, not global (see
`docs/SAAS-ARCHITECTURE.md` §3 for why).

---

## Domain model

```
Tenant  (UUID id, public slug, lifecycle status, coordinator assignment)
 ├── Person                              ← the existing profile domain, unmodified
 │     ├── Contact (1:1) ──── ContactSocialLink
 │     ├── Experience ─────── ExperienceResponsibility
 │     │              ├─── ExperienceAchievement
 │     │              └─── ExperienceTechnology ──┐
 │     ├── Project ────────── ProjectHighlight     ├──▶ Technology (per-tenant, reusable)
 │     │              └─── ProjectTechnology ──────┘
 │     ├── Achievement
 │     ├── Course ─────────── CourseSkill
 │     ├── TimelineEvent
 │     ├── ManagementRole ─── ManagementResponsibilityItem
 │     │                └─── ManagementAchievement
 │     └── SkillCategory ──── Skill
 ├── User (role CLIENT, the tenant's one administrator)
 ├── Subscription ──▶ Plan
 ├── Payment[]
 ├── TenantTheme
 ├── WebsiteSettings
 └── TenantSlugHistory[]

User (role ADMIN | COORDINATOR) — tenantId always null; a Coordinator's tenants are found
                                  via Tenant.coordinatorId, not a relation on User.
```

Management roles are a **separate** concept from experiences and are never merged with
them. Responsibilities and highlights stay individual rows, never collapsed into strings.

Additions to the original profile domain, each justified where it's introduced:

| Addition | Why |
| --- | --- |
| `sortOrder` on every ordered collection | The source data has no ordering field; SQL rows have no inherent order. Seeded from array index. |
| `isPublished` on person-owned root entities | Admin CRUD needs draft state; nothing in the source expressed visibility. Defaults `true`. |
| `SkillCategory` + `Skill` | 117 skills across 14 categories with their own page — omitting them would leave the Skills page on static data. |
| `Tenant`, `User`, `Role` | The SaaS platform layer itself — see `docs/SAAS-ARCHITECTURE.md`. |
| `Subscription`, `Plan`, `Payment` | Provider-agnostic billing domain. |
| `TenantTheme`, `WebsiteSettings` | Per-tenant visual configuration, separate from profile content. |
| `AuditLog` | Append-only trail of every platform and tenant mutation. |

---

## API

Namespaced by authorization boundary:

```
/api/v1/auth/*          POST login (anonymous), GET me (any authenticated role)
/api/v1/public/*         anonymous - the public site
/api/v1/admin/*          Role.ADMIN only
/api/v1/coordinator/*    Role.COORDINATOR only
/api/v1/tenant/*         Role.CLIENT only - always the caller's own tenant
```

### Public

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/public/tenants/:tenantSlug/profile` | One tenant's whole profile: person, contact, experiences, projects, achievements, courses, timeline, management roles, skills, theme, website settings. ETag + Last-Modified. A retired slug still resolves via history (`X-Tenant-Slug-Current` header). |
| `GET` | `/api/v1/health` | Liveness/readiness, including a real database round-trip. |

Those, plus `POST /auth/login`, are the **only** anonymous endpoints. Everything else
requires a token and a matching role — including the collection endpoints
(`/tenant/experiences`, `/tenant/technologies`, …), which exist for the Client control panel,
not the public site.

### Client — `/api/v1/tenant/*`, requires `Role.CLIENT`

```
GET    /tenant/me                       ← identifies the caller's own tenant
GET    /tenant/profile   PATCH /tenant/profile
GET    /tenant/contact   PATCH /tenant/contact
GET    /tenant/theme     PATCH /tenant/theme
GET    /tenant/settings  PATCH /tenant/settings
GET    /tenant/subscription             ← read-only; status/plan are Admin-controlled
GET    /tenant/payments                 ← read-only payment history
```

Full CRUD for `experiences`, `projects`, `technologies`, `achievements`, `courses`,
`timeline-events`, `management-roles`, `skill-categories`, plus nested operations:

```
POST   /tenant/experiences/:id/responsibilities
PATCH  /tenant/experiences/responsibilities/:responsibilityId
POST   /tenant/experiences/:id/technologies      ← attaches by name, never duplicates
POST   /tenant/projects/:id/highlights
POST   /tenant/skill-categories/:id/skills
PATCH  /tenant/<collection>/reorder              ← bulk sortOrder update
```

**PATCH semantics for child collections:** omitting a child array leaves it untouched;
sending `[]` clears it.

### Admin — `/api/v1/admin/*`, requires `Role.ADMIN`

```
GET/POST     /admin/tenants                      PATCH /admin/tenants/:id
PATCH        /admin/tenants/:id/status            ← lifecycle-validated transitions
PATCH        /admin/tenants/:id/coordinator       ← assign/reassign
POST         /admin/tenants/:id/reset-access      ← new temp password, returned once
GET          /admin/tenants/:id/activity          ← this tenant's audit trail
GET/POST     /admin/coordinators   GET/POST /admin/admins
GET          /admin/users          PATCH /admin/users/:id/status
GET/POST     /admin/plans          PATCH /admin/plans/:id
GET          /admin/subscriptions  PATCH /admin/tenants/:id/subscription
GET/POST     /admin/payments
GET          /admin/audit-logs
```

### Coordinator — `/api/v1/coordinator/*`, requires `Role.COORDINATOR`

```
GET/POST  /coordinator/tenants          ← scoped to Tenant.coordinatorId = caller
GET/PATCH /coordinator/tenants/:id      ← 404, not 403, for an unassigned tenant
```

### Performance

The public endpoint issues a fixed, small number of SQL statements — one per relation
level, not one per row — regardless of how many experiences, projects or skills a tenant
has. The payload is bounded by one CV's worth of content and is never paginated; admin list
endpoints that can genuinely grow large accept `page`/`limit`.

---

## Security

| Control | Implementation |
| --- | --- |
| Authentication | JWT bearer tokens, Argon2id password hashing |
| Authorization | `JwtAuthGuard` (deny-by-default, `@Public()` opts out) then `RolesGuard` (`@Roles(...)` restricts by role) |
| Tenant isolation | Resolved from the database at JWT validation, never client-supplied; every by-id query scoped by `personId`/tenant |
| Rate limiting | 120 req/min globally; **5 req/min** on `POST /auth/login` |
| Headers | Helmet |
| CORS | Explicit origin allowlist; the app **refuses to start** if `CORS_ORIGINS` contains `*` in production |
| Validation | Global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform` |
| Request size | 256 KB limit on JSON and urlencoded bodies |
| Error handling | Single exception filter; Prisma errors mapped to correct status codes, internal messages never returned |
| Audit trail | Append-only `AuditLog`; every tenant lifecycle and billing mutation recorded |

Deny-by-default plus deny-by-role is the important pairing: adding a new mutation endpoint
cannot leave it unprotected through a forgotten decorator, and cannot leave it reachable by
the wrong persona through a forgotten `@Roles()`.

Login failures are indistinguishable — unknown email and wrong password return the same
message, and an unknown email still runs an Argon2 verification against a dummy hash so
response timing does not reveal which emails exist on the platform.

**Never logged:** passwords, JWTs, secrets, the attempted email on a failed login, Prisma
query contents, or anything in an `AuditLog.metadata` field (which never carries a
credential).

---

## Environment

Every variable is validated at startup — the process refuses to boot rather than failing on
the first request that needs it. See `.env.example`.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string (pooled, for runtime) |
| `DIRECT_URL` | yes | Direct/session connection, for migrations |
| `JWT_SECRET` | yes | **≥ 32 characters**, enforced |
| `CORS_ORIGINS` | yes | Comma-separated origins; no wildcard in production |
| `PORT` | no | Default `3000` |
| `JWT_EXPIRES_IN` | no | Default `7d` |
| `THROTTLE_TTL_SECONDS` / `THROTTLE_LIMIT` | no | Default `60` / `120` |
| `AUTH_THROTTLE_LIMIT` | no | Default `5` |
| `SWAGGER_ENABLED` | no | Defaults on outside production |
| `PLATFORM_ADMIN_EMAIL` / `_PASSWORD` | seed only | Bootstraps the first `Role.ADMIN`. There is no API to create the first admin — every admin-creation endpoint requires an authenticated admin already. |
| `SEED_COORDINATOR_EMAIL` / `_PASSWORD` | seed only | Optional demo coordinator. |
| `SEED_CLIENT_EMAIL` / `_PASSWORD` | seed only | The `default` tenant's Client login. Falls back to `ADMIN_EMAIL` / `ADMIN_PASSWORD` if unset. |

---

## Testing

```bash
yarn test         # unit tests
yarn test:e2e     # end-to-end against a real database
yarn test:cov     # coverage
```

E2E requires a migrated database (`docker compose up -d && yarn prisma:deploy`); each e2e
file builds its own tenant/user fixtures directly via Prisma rather than depending on
`yarn db:seed`, so what credentials the seed happens to produce never affects the suite.

- `test/app.e2e-spec.ts` — health, auth, one tenant's public profile, Client CRUD under
  `/tenant/*` with nested children and technology reuse.
- `test/saas.e2e-spec.ts` — the platform layer: RBAC across all three roles, tenant
  lifecycle transitions, coordinator assignment and scoping, slug validation (reserved
  words, duplicate rejection, auto-suffix generation, retired-slug redirects), billing
  isolation, audit log content. Its cross-tenant isolation tests hold a **valid** token for
  one tenant and use **real** record ids from another — every read, update, delete, nested
  child and bulk-reorder attempt returns 404, verified against the untouched original data
  afterward.
- `test/rate-limit.e2e-spec.ts` — the login throttle actually blocks repeated attempts,
  and does not leak into unrelated routes.

---

## Scripts

| Command | Purpose |
| --- | --- |
| `yarn start:dev` | Development with watch |
| `yarn build` / `yarn start:prod` | Production build and run |
| `yarn lint` | ESLint, zero warnings tolerated |
| `yarn prisma:migrate` | Create + apply a migration (development only) |
| `yarn prisma:deploy` | Apply committed migrations (**production**) |
| `yarn db:seed` | Import the vendored Angular data as the `default` tenant |
| `yarn db:reset` | Drop, re-migrate, re-seed (destructive; local only) |
| `./scripts/sync-frontend-data.sh [path]` | Refresh the vendored snapshot from the Angular repo |

---

## Project layout

```
src/
├── main.ts                  # bootstrap: helmet, CORS, validation, versioning, swagger
├── app.module.ts             # global guards (throttler, JWT, roles), exception filter
├── config/                   # env validation - fails fast at startup
├── common/                   # decorators (@Roles, @Public, @CurrentUser), guards, slug util
├── prisma/                   # PrismaService
├── auth/                     # login (all roles), JWT strategy, deny-by-default guard
│
├── tenant/                   # Tenant CRUD, lifecycle, onboarding transaction
├── tenant-access/            # public-visibility decision (status + subscription)
├── user/                     # platform Admin/Coordinator account management
├── billing/                  # Plan, Subscription, Payment
├── theme/  website-settings/ # per-tenant visual + site configuration
├── audit/                    # append-only AuditLog
│
├── person/ contact/ experience/ project/ technology/
├── achievement/ course/ timeline-event/ management-role/ skill/
│                            # the original profile domain - unmodified, scoped by personId
│
├── public/                   # the single anonymous per-tenant endpoint
└── health/
prisma/
├── schema.prisma
├── migrations/
├── data/                     # vendored snapshot of the Angular JSON
└── seed.ts                   # the import (default tenant + optional admin/coordinator)
```

No business logic lives in a controller, and no Prisma model is ever returned directly —
every response goes through an explicit DTO mapping.
