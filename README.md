# Profile API

NestJS + Prisma + PostgreSQL backend for the Angular profile/portfolio site. It moves the
profile data out of the frontend and makes the database the source of truth.

**Every profile is a tenant.** One deployment can host many people's portfolios, each with
its own administrator, fully isolated from the others.

```
Angular (GitHub Pages)  ──HTTPS──▶  NestJS REST API  ──▶  Prisma  ──▶  PostgreSQL
```

The Angular app calls **one** endpoint — `GET /api/v1/public/profile/:slug` — instead of
loading nine static JSON files.

## Documentation

| Document | What it covers |
| --- | --- |
| [`docs/MIGRATION-MAPPING.md`](docs/MIGRATION-MAPPING.md) | Field-by-field mapping from the Angular models to Prisma, and the eight conflicts found while inspecting the existing data. **Read this first.** |
| [`docs/ANGULAR-INTEGRATION.md`](docs/ANGULAR-INTEGRATION.md) | How to switch the frontend over without changing any component. |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Production deployment, migrations, and required secrets. |
| `/api/docs` | Swagger UI (on by default outside production). |

---

## Quick start

```bash
cp .env.example .env          # then edit JWT_SECRET and ADMIN_PASSWORD
yarn install
docker compose up -d          # local PostgreSQL on :5432
yarn prisma:generate
yarn prisma:migrate           # creates the schema
yarn db:seed                  # imports the Angular data
yarn start:dev
```

- API: <http://localhost:3000/api/v1>
- Swagger: <http://localhost:3000/api/docs>
- Health: <http://localhost:3000/api/v1/health>
- Public profile: <http://localhost:3000/api/v1/public/profile>

---

## The data import

The seed is a **migration, not a fixture generator**. Every value comes from the real
Angular data; nothing is invented.

```
myProfile/public/assets/data/*.json
        │
        │  ./scripts/sync-frontend-data.sh ../myProfile
        ▼
prisma/data/*.json          ← vendored snapshot, committed so CI and Docker can seed
        │
        │  yarn db:seed
        ▼
PostgreSQL
```

The snapshot is vendored because the seed must run in CI and in a Docker build, where the
Angular repository is not available. Re-sync it whenever the frontend data changes.

A run reports exactly what it imported:

```
  person            1  (Ahmed Mohsen Albaz)
  contact           1  (+4 social links)
  technology       57  (deduplicated from 130 references)
  experience        9  (+51 responsibilities, +27 achievements, +61 technology links)
  project          16  (+64 highlights, +69 technology links)
  achievement      10
  course           27  (+147 course skills)
  timeline_event   18
  mgmt_role         3  (+17 responsibilities, +12 achievements)
  skill_category   14  (+117 skills)
  admin_user        1  (credentials taken from environment)
```

The seed is **idempotent** — it upserts on `person.slug`, `(personId, legacyId)` and
`(personId, technology.slug)`, so re-running updates in place rather than duplicating. It
targets the default tenant; other tenants are created with `yarn tenant:create`.

### Technology de-duplication

There is no `technology.json`; the table is derived from the names referenced inline by
experiences and projects. Matching is on a normalised slug (`Node.js`, `NodeJS` and
`node js` all collapse to `node-js`), so a technology used in both an experience and a
project gets **one** row referenced from both sides. In the current data that is 57
technologies from 130 references, with 4 shared between the two.

---

## Multi-tenancy

A `Person` **is** a tenant: one profile and everything beneath it. An `AdminUser` belongs to
exactly one Person and can only ever see or change that tenant's rows.

```
Person "ahmed"  ──  AdminUser ahmed@…   ──▶  /api/v1/public/profile/ahmed
Person "jane"   ──  AdminUser jane@…    ──▶  /api/v1/public/profile/jane
```

**The tenant is never client-supplied.** It is resolved from the database during JWT
validation, so an administrator cannot name someone else's tenant in a parameter or body.

Isolation is enforced at three levels:

| | How |
| --- | --- |
| Lists | Every query filters on `personId`. |
| By-id reads and writes | `findFirst({ where: { id, personId } })` rather than `findUnique({ where: { id } })`, so another tenant's real id returns **404**, not their data. |
| Child rows | Reached through the parent: `where: { id, experience: { personId } }`. |
| Bulk reorder | `updateMany` filtered by `personId`, so a foreign id matches nothing instead of silently renumbering another tenant's rows. |

Key spaces are per-tenant too: `legacyId` is unique on `(personId, legacyId)` so two people
can each have an `exp1`, and `technology` is owned by a tenant rather than shared. A global
technology table would have let one tenant rename or delete a technology another tenant's
records point at, and would have exposed every tenant's stack through the list endpoint.

### Adding a tenant

```bash
TENANT_SLUG=jane TENANT_NAME='Jane Doe' \
TENANT_ADMIN_EMAIL=jane@example.com TENANT_ADMIN_PASSWORD='<12+ chars>' \
yarn tenant:create
```

That creates an empty profile and its administrator. They sign in at `/admin` and fill it in
themselves; no data is copied from any other tenant.

## Domain model

```
person
 ├── contact (1:1) ──── contact_social_link
 ├── experience ─────── exp_responsibility
 │                 ├─── exp_achievement
 │                 └─── exp_technology ──┐
 ├── project ────────── proj_highlight   ├──▶ technology  (reusable)
 │                 └─── proj_technology ─┘
 ├── achievement
 ├── course ─────────── course_skill
 ├── timeline_event
 ├── mgmt_role ──────── mgmt_responsibility
 │                 └─── mgmt_achievement
 └── skill_category ─── skill
```

Management roles are a **separate** concept from experiences and are never merged with
them. Responsibilities and highlights stay individual rows, never collapsed into strings.

Three deliberate additions to the existing model, each justified in the mapping document:

| Addition | Why |
| --- | --- |
| `sortOrder` on every ordered collection | The source data has no ordering field; the UI relies on JSON array position, and SQL rows have no inherent order. Seeded from the array index, so the first response reproduces the current order exactly. |
| `isPublished` on person-owned root entities | Nothing in the source expresses visibility, and admin CRUD without draft state means every edit is live immediately. Defaults to `true`. |
| `skill_category` + `skill` | 117 skills across 14 categories with their own page. Omitting them would leave the Skills page on static data, defeating the point of the migration. |

---

## API

### Public

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/public/profile/:slug` | One tenant's whole profile. ETag + Last-Modified. |
| `GET` | `/api/v1/public/profile` | Same, for the default tenant (`DEFAULT_PROFILE_SLUG`). |
| `GET` | `/api/v1/health` | Liveness/readiness, including a real database round-trip. |

Those two are the **only** anonymous endpoints, alongside `POST /auth/login`. The
collection endpoints (`/experiences`, `/projects`, `/technologies`, …) exist for the admin
UI and require a token — the public site reads the profile payload and nothing else.

### Admin — requires `Authorization: Bearer <token>`

```
POST   /api/v1/auth/login
GET    /api/v1/auth/me
```

Full CRUD for `person`, `contact`, `experience`, `project`, `technology`, `achievement`,
`course`, `timeline-event`, `management-role` and `skill-category` — every one of them
scoped to the caller's tenant. `person` and `contact` take no id in the path, because the
tenant already identifies which profile is being edited. Nested operations:

```
POST   /api/v1/experiences/:id/responsibilities
PATCH  /api/v1/experiences/responsibilities/:responsibilityId
DELETE /api/v1/experiences/responsibilities/:responsibilityId
POST   /api/v1/experiences/:id/achievements
POST   /api/v1/experiences/:id/technologies          ← attaches by name, never duplicates
DELETE /api/v1/experiences/:id/technologies/:technologyId
POST   /api/v1/projects/:id/highlights
POST   /api/v1/projects/:id/technologies
POST   /api/v1/skill-categories/:id/skills
PATCH  /api/v1/<collection>/reorder                  ← bulk sortOrder update
```

**PATCH semantics for child collections:** omitting a child array leaves it untouched;
sending `[]` clears it. Without that distinction, patching a job title would silently wipe
the responsibilities.

### Performance

The public endpoint issues **21 SQL statements** — one per relation level, a fixed number
that does not grow with the number of experiences, projects or skills. An N+1
implementation over the same data would issue 100+. The payload is ~72 KB and is never
paginated; admin list endpoints accept `page`/`limit`.

---

## Security

| Control | Implementation |
| --- | --- |
| Authentication | JWT bearer tokens, Argon2id password hashing |
| Authorization | Global `JwtAuthGuard` — **deny by default**, routes opt out with `@Public()` |
| Tenant isolation | Resolved from the database at JWT validation, never client-supplied; every query scoped by `personId` |
| Rate limiting | 120 req/min globally; **5 req/min** on `POST /auth/login` |
| Headers | Helmet |
| CORS | Explicit origin allowlist; the app **refuses to start** if `CORS_ORIGINS` contains `*` in production |
| Validation | Global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform` |
| Request size | 256 KB limit on JSON and urlencoded bodies |
| Error handling | Single exception filter; Prisma errors mapped to correct status codes, internal messages never returned |

Deny-by-default is the important one: adding a new mutation endpoint cannot leave it
unprotected through forgetting a decorator.

Login failures are deliberately indistinguishable — unknown email and wrong password return
the same message, and an unknown email still runs an Argon2 verification against a dummy
hash so response timing does not reveal which admin emails exist.

**Never logged:** passwords, JWTs, secrets, the attempted email on a failed login, or
Prisma query contents (rows contain personal contact data).

---

## Environment

Every variable is validated at startup — the process refuses to boot rather than failing on
the first request that needs it. See `.env.example`.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | **≥ 32 characters**, enforced. `openssl rand -base64 48` |
| `CORS_ORIGINS` | yes | Comma-separated origins; no wildcard in production |
| `PORT` | no | Default `3000` |
| `JWT_EXPIRES_IN` | no | Default `7d` |
| `THROTTLE_TTL_SECONDS` / `THROTTLE_LIMIT` | no | Default `60` / `120` |
| `AUTH_THROTTLE_LIMIT` | no | Default `5` |
| `SWAGGER_ENABLED` | no | Defaults on outside production |
| `DEFAULT_PROFILE_SLUG` | no | Tenant served by `/public/profile` with no slug. Default `default`. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | seed only | Supply as deployment secrets; never commit |

---

## Testing

```bash
yarn test         # unit tests (28)
yarn test:e2e     # end-to-end against a real database (51)
yarn test:cov     # coverage
```

E2E requires a migrated and seeded database (`docker compose up -d && yarn prisma:deploy && yarn db:seed`).

Coverage includes: authentication (valid/invalid/missing/garbage token, deactivated
account, uniform failure messages), the public profile (structure, relationships, ordering,
technology de-duplication, no metadata leakage, published-only filtering, ETag/304), CRUD
with nested children and technology reuse, rate limiting, and that anonymous callers cannot
mutate anything.

`test/tenancy.e2e-spec.ts` covers isolation specifically: it creates two tenants, gives one
of them content, then checks that the other — holding a **valid** token and using the
first's **real** record ids — gets 404 on every read, update, delete, nested-child and
reorder attempt, and that both tenants can independently own a technology of the same name
and a record with the same `legacyId`.

---

## Scripts

| Command | Purpose |
| --- | --- |
| `yarn start:dev` | Development with watch |
| `yarn build` / `yarn start:prod` | Production build and run |
| `yarn lint` | ESLint, zero warnings tolerated |
| `yarn prisma:migrate` | Create + apply a migration (development only) |
| `yarn prisma:deploy` | Apply committed migrations (**production**) |
| `yarn db:seed` | Import the vendored Angular data into the default tenant |
| `yarn tenant:create` | Create an additional profile (tenant) and its administrator |
| `yarn db:reset` | Drop, re-migrate, re-seed (destructive; local only) |
| `./scripts/sync-frontend-data.sh [path]` | Refresh the vendored snapshot from the Angular repo |

---

## Project layout

```
src/
├── main.ts                  # bootstrap: helmet, CORS, validation, versioning, swagger
├── app.module.ts            # global guards (throttler, JWT), exception filter
├── config/                  # env validation - fails fast at startup
├── common/                  # decorators, filters, shared DTOs
├── prisma/                  # PrismaService
├── auth/                    # login, JWT strategy, deny-by-default guard
├── person/ contact/ experience/ project/ technology/
├── achievement/ course/ timeline-event/ management-role/ skill/
├── public/                  # the single optimised frontend endpoint
└── health/
prisma/
├── schema.prisma
├── migrations/
├── data/                    # vendored snapshot of the Angular JSON
└── seed.ts                  # the import
```

No business logic lives in a controller, and no Prisma model is ever returned directly —
every response goes through an explicit DTO mapping.
