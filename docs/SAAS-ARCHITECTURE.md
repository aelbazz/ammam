# SaaS Platform Architecture

How the single-tenant profile backend became a multi-tenant SaaS platform: personas, the
tenant/RBAC model, isolation guarantees, billing, and the reasoning behind the choices that
aren't obvious from the code alone. Read [`MIGRATION-MAPPING.md`](MIGRATION-MAPPING.md)
first for the original profile-domain mapping — nothing in that document changed; this one
describes the platform layer built around it.

---

## 1. The central invariant

```
USER  →  TENANT  →  ONLY THAT TENANT'S DATA
```

The tenant is **never** taken from a route parameter, a request body, or anything else the
client supplies. It is resolved from the database during JWT validation, the same place the
account's active/suspended status is already re-checked on every request. A CLIENT's
`tenantId` — and, from it, `personId` — is attached to `req.user` there and nowhere else.

Every by-id lookup on tenant-owned data uses this pattern:

```typescript
// NOT this - resolves any row that exists, regardless of owner:
await prisma.experience.findUnique({ where: { id } });

// This - a foreign id resolves to nothing, not to someone else's row:
await prisma.experience.findFirst({ where: { id, personId } });
```

Verified directly in `test/saas.e2e-spec.ts`: a CLIENT holding a **valid** token for tenant
B, given tenant A's **real** record ids, gets 404 on every read, update, delete, nested-child
and reorder attempt — not 403, so a probing caller cannot even learn that the id exists.

---

## 2. Personas

| | ADMIN | COORDINATOR | CLIENT |
|---|---|---|---|
| Scope | every tenant | tenants assigned to them | their own tenant |
| `User.tenantId` | always `null` | always `null` | the one tenant they manage (`@unique`) |
| Finds their tenants via | no filter | `Tenant.coordinatorId = user.id` | `user.tenantId` |
| Can create a tenant | yes, any coordinator | yes, self-assigned | no |
| Can change tenant status | yes | no | no |
| Can reassign a coordinator | yes | no | no |
| Manages billing | yes (read/write) | no | read-only, own tenant |
| Manages platform admins/coordinators | yes | no | no |

A Coordinator does **not** automatically see every tenant — only the ones with
`coordinatorId` pointing at them. `GET /coordinator/tenants` filters on that; a coordinator
who tries `GET /coordinator/tenants/:id` for an unassigned tenant gets 404, the same
response as a tenant that doesn't exist, so nothing is revealed either way.

### Why `Tenant.coordinatorId` and not a `TenantMembership` join table

The spec explicitly allows starting simple: "keep the implementation simple for the initial
version." A single nullable FK on `Tenant` gives a coordinator "their assigned tenants" via
one indexed lookup and gives an admin reassignment via one `PATCH`. It cannot express a
tenant with *multiple* coordinators — if that's ever needed, replace the column with a
`TenantCoordinator(tenantId, coordinatorId)` join table; every caller of
`TenantService.findAllForCoordinator` / `findOneForCoordinator` changes to a join instead of
a `WHERE`, and nothing above the service layer needs to know.

---

## 3. Tenant vs. Person

```
Tenant                          Person (unchanged profile domain)
  id       UUID, internal         id
  slug     public, in URLs        tenantId  ← the only new field
  status   lifecycle              name, title, summary, experiences, projects, ...
  ...
```

A `Tenant` is the **account**: identity, lifecycle, billing, coordinator assignment. A
`Person` is the **profile content** — exactly the domain described in
`MIGRATION-MAPPING.md`, completely unmodified except that its old ad-hoc `slug` field (which
used to *be* the tenant boundary) is now `tenantId`, a real foreign key to `Tenant`.

**Nothing below Person changed.** `Experience`, `Project`, `Technology`, `Achievement`,
`Course`, `TimelineEvent`, `ManagementRole`, `Skill` — every service still scopes by
`personId` exactly as it did before this platform layer existed. What changed is only how a
CLIENT's `personId` is *resolved*: through their tenant now, in one query, during JWT
validation, rather than a Person being the tenant itself. See `AuthenticatedUser.personId`'s
doc comment in `src/common/decorators/current-user.decorator.ts` for the full reasoning —
this is what kept the existing ~10 profile-domain controllers to a two-line change each
(a route-prefix rename and an `@Roles(Role.CLIENT)` decorator) instead of a rewrite.

### `Technology` is tenant-owned, not global

A single shared `Technology` table would let one tenant rename or delete a technology
another tenant's records depend on, and would expose every tenant's stack through the list
endpoint. `Technology.personId` plus a unique `(personId, slug)` constraint means two
tenants can each have their own "Angular" row, invisible to each other. Verified: creating
"AlphaScript" as tenant B when tenant A already owns a technology of that name produces two
separate rows, each referenced only by its own owner.

### `legacyId` is unique per tenant, not globally

The original static-data ids (`exp1`, `proj14`, ...) are preserved for frontend
compatibility (`track exp.id`, `#project-<id>` anchors) but are now unique on
`(personId, legacyId)` rather than globally. Two tenants can each have an `exp1` — the id
generator (`nextLegacyId`) continues each tenant's own sequence.

---

## 4. Public URLs: UUID internal, slug public

```
Tenant.id    → every database relation, every authorization check
Tenant.slug  → GET /api/v1/public/tenants/:slug/profile, and nothing else
```

The slug is **never** a security boundary — a slug collision or a guessed slug reveals
nothing beyond what `GET .../profile` already returns publicly (or a 404 if the tenant is
not currently visible; see §6). Every protected mutation is authorized by `user.tenantId`,
resolved server-side, never by anything containing "slug" in the request.

### Slug rules

Enforced by `src/common/utils/slug.util.ts` and `TenantService`:

- Lower-case, ASCII, hyphen-joined, 1–63 characters (DNS-label-length, a conservative cap).
- **Reserved words are rejected outright**, never silently modified. Requesting the exact
  slug `"admin"` returns `400`. This was a real bug caught while building this: the first
  implementation treated an explicit request the same as name-based generation, so
  `"admin"` silently became `"admin-2"` instead of being refused — confusing, and it let a
  reserved word be "worked around" by accident. Fixed by splitting the two paths:
  `acceptExplicitSlug` (strict: 400 on invalid/reserved, 409 on taken, never rewrites what
  the caller asked for) vs. `generateSlugFromName` (the auto-suffix fallback, used only when
  no slug was given).
- An explicitly taken slug is `409`, not a silent substitution, for the same reason.
- Auto-generation from a name suffixes on collision: `"Jane Doe"` → `jane-doe`, then
  `jane-doe-2`, `jane-doe-3`, ...

Reserved list (`RESERVED_SLUGS`): `admin`, `coordinator`, `client`, `login`, `register`,
`logout`, `api`, `auth`, `assets`, `settings`, `dashboard`, `favicon`, `favicon.ico`,
`robots.txt`, `sitemap.xml`, `public`, `health`, `docs`, `www`, `app`, `static`, `profile`.
It is one `Set` consulted everywhere a slug is validated — not duplicated per call site.

### Slug history and redirects

Renaming a tenant (`PATCH /admin/tenants/:id` with a new `slug`) writes the *old* slug into
`TenantSlugHistory` rather than discarding it. The public lookup tries the live
`Tenant.slug` first, and falls back to history on a miss — a previously shared profile URL
degrades to "still resolves, with the current slug echoed back" instead of a plain 404.

The response carries an `X-Tenant-Slug-Current` header when this happens, rather than an
HTTP 3xx redirect. A genuine redirect was considered and deliberately not built: this is a
JSON API response, not a page navigation, and the frontend integration guide describes
updating the address bar from that header instead — simpler than teaching every API client
to follow redirects on a data endpoint.

**A tenant can rename back to its own retired slug.** `isSlugFree` treats a
`TenantSlugHistory` row as "available" when it belongs to the *same* tenant being renamed —
reclaiming your own previous name is harmless and should not be blocked as if a different
tenant owned it. Renaming back deletes the stale history row rather than leaving a
self-referential "retired" entry standing.

---

## 5. RBAC

`Role` is a Prisma enum (`ADMIN | COORDINATOR | CLIENT`) on `User.role`. Authorization has
two guards, both registered globally in `app.module.ts`, in this order:

```
ThrottlerGuard → JwtAuthGuard → RolesGuard
```

- **`JwtAuthGuard`**: deny-by-default. A route is anonymous only if it carries `@Public()`.
- **`RolesGuard`**: reads `@Roles(...)` metadata. No `@Roles()` at all means "any
  authenticated user" (e.g. `GET /auth/me`); `@Roles(Role.CLIENT)` means exactly that role,
  rejecting others with `403`.

Every controller in the platform layer declares its role at the **class** level, so a
handler cannot be added later without inheriting the restriction:

```typescript
@Roles(Role.CLIENT)
@Controller('tenant/experiences')
export class ExperienceController { ... }
```

This is a genuine authorization boundary, not a UI convenience — verified directly:
`ADMIN` and `COORDINATOR` tokens both get `403` from every `/tenant/*` route, `CLIENT` gets
`403` from `/admin/*` and `/coordinator/*`, and a coordinator token against an unassigned
tenant gets `404`.

---

## 6. Subscription enforcement

`TenantAccessService` (`src/tenant-access/`) is the single place "is this tenant's public
site reachable right now?" is decided:

```typescript
Tenant.status !== ACTIVE           → blocked (PENDING, SUSPENDED, ARCHIVED)
no Subscription row                → blocked
Subscription.status TRIAL|ACTIVE|PAST_DUE   → allowed (PAST_DUE is a grace period)
Subscription.status EXPIRED|SUSPENDED|CANCELLED → blocked
Tenant.isPublished === false       → blocked (the client's OWN switch - see §14)
```

`PublicProfileService` calls this and returns the **same 404** whether the tenant doesn't
exist, was never registered at that slug, or exists but isn't currently visible — an
anonymous caller cannot distinguish "no such profile" from "suspended profile," which is the
point: a suspended tenant's URL should not announce that it used to be a paying customer.

This is a decision service, not scattered `if` statements — a future billing webhook or an
admin "preview my suspended site" feature calls the same method rather than re-deriving the
rule.

---

## 7. Onboarding

`TenantService.create` is one Prisma `$transaction`:

```
Tenant (PENDING)
  → Person (placeholder content - "Add your professional title", etc.;
            avatar = the built-in default SVG, avatarSource = DEFAULT)
  → User (role CLIENT, tenantId set)
  → Subscription (on the given or default plan, status TRIAL)
  → TenantTheme (schema defaults)
  → WebsiteSettings (schema defaults, title = tenant name)
  → ClientSection × one per section-registry.ts key, all enabled, in registry order
```

All or nothing — if any step fails (a duplicate client email, an invalid plan), nothing is
left half-created. A tenant starts `PENDING`, not `ACTIVE`: an Admin (or the Coordinator who
created it) explicitly activates it via `PATCH .../status`, so a signup in progress is never
accidentally public.

Placeholder content is generic ("Add your location") and never claims to be real
information about anyone — the new CLIENT fills in their own profile after signing in.

---

## 8. Tenant lifecycle

```
PENDING ──────────────┬──▶ ACTIVE ⇄ SUSPENDED
                       │       │         │
                       └───────┴─────────┴──▶ ARCHIVED (terminal)
```

Enforced by `TenantLifecycleService.assertTransition`, called before every status write.
Setting the same status twice is a harmless no-op; every other transition not drawn above is
rejected with `400` and an explicit message. `ARCHIVED` is terminal by design — nothing
reactivates an archived tenant, matching the "prefer soft delete for SaaS entities" guidance
elsewhere in the spec; there is deliberately no path back out of it.

---

## 9. Billing

Provider-agnostic by construction: `Plan`, `Subscription`, `Payment` carry no assumption
about *how* money moved. `Payment.provider` is `"manual"` today; integrating Stripe (or
anything else) later means adding rows here and flipping `Subscription.status` from a
webhook handler — it never needs to touch the tenant or profile domain.

**A CLIENT never writes billing state.** `TenantBillingController` (`/tenant/subscription`,
`/tenant/payments`) is read-only — there is no `PATCH` route a CLIENT token can reach for
either resource, verified directly in the e2e suite (`403` on the admin-only endpoints, and
no write endpoint exists to even attempt on the tenant-scoped ones). Status, plan, and
renewal date are `AdminBillingController`-only.

`GET /admin/subscriptions` supports `status` / `tenantId` / `planId` filters and returns
`daysRemaining` (derived from `renewalDate`) so an admin dashboard can sort by urgency
without recomputing it client-side.

---

## 10. Audit logging

`AuditLogService.log(...)` is a `@Global()` provider — any module injects it without
importing a whole audit module. Entries are append-only; nothing in this codebase updates or
deletes one. Logging failures are swallowed rather than thrown: a mutation like suspending a
tenant must never fail *because* the audit write failed.

Wired into every tenant lifecycle mutation (create, status change, coordinator reassignment,
access reset), every profile-domain write that goes through the platform layer, subscription
changes, and payment records. `actorRole` is a snapshot taken at write time — if a user's
role changes later, historical entries still show what was true when the action happened.

**Never logged:** the entry schema has no field for a password, token, or secret, and
`metadata` is the caller's own small structured context (e.g. `{ from: 'ACTIVE', to:
'SUSPENDED' }") — verified directly: a payload search for a real password and a real JWT
across every returned audit entry finds neither.

---

## 11. Theme security

`TenantTheme.customCss` is optional, tenant-authored CSS, capped at 20 KB at the DTO layer.
The **contract** with the frontend is: render it inside a scoped `<style>` tag, never
`eval`, never inject into a `<script>` context, never interpolate into HTML attributes
un-escaped. CSS can change appearance — colors, layout, even `content:` injection for
decorative text — but cannot execute script, read cookies, or make network requests the way
injected HTML/JS could.

What this does **not** protect against: a tenant using `customCss` to make their own public
page visually confusing (fake "Verified" badges via `content:`, hiding elements, etc.) is a
content-moderation question for the platform operator, not a security one — the blast radius
of CSS-only injection is confined to that tenant's own rendered page.

---

## 12. What is deliberately out of scope (for now)

Matching the spec's own "do not build/integrate yet" guidance:

- **No Stripe/payment-provider integration.** `Payment.provider` and the billing domain
  are shaped so one can be added without touching the tenant/profile domain, but none is
  wired up.
- **No dynamic permission-management UI.** RBAC is a static `Role` enum and `@Roles()`
  guard, not a database-driven permission system.
- **No platform-admin or coordinator Angular UI.** The backend fully supports building
  one (every endpoint under `/admin/*` and `/coordinator/*` exists and is tested); the
  Angular application in this iteration ships the CLIENT-facing control panel only. See
  `ANGULAR-INTEGRATION.md` for exactly what is and is not wired up on the frontend.
- **No true HTTP redirect on slug history** — see §4.
- **No email-based invitation flow.** An Admin sets a new tenant's client credentials
  directly (`clientEmail` / `clientPassword` in the create request) rather than sending an
  invite email; there is no email-sending integration in this backend.

---

## 13. The Portfolio marketing site and contact submissions

The platform itself (branded "Portfolio") has a public marketing site — `/`, `/about`,
`/services`, `/contact` on the frontend — that is **not** a tenant profile. It is served
alongside every tenant's own public profile (`/:tenantSlug`), and the two are kept
architecturally separate:

- **Reserved slugs**: `about`, `services`, `contact` were added to `RESERVED_SLUGS`
  (`src/common/utils/slug.util.ts`) alongside the existing platform routes, so no tenant can
  ever claim a marketing route as their own slug.
- **`ContactSubmission`** (`src/contact-submission/`) is the "contact us" inbox for
  Portfolio's own `/contact` page — deliberately distinct from the pre-existing `Contact`
  model, which is a *tenant's own* published contact info. `ContactSubmission` carries no
  `tenantId`: it is a platform-level inquiry, not tenant data.
- **Public write, admin-only read**: `POST /contact-submissions` is `@Public()` and rate-
  limited the same way login is (`@Throttle` overriding the single `'default'` throttler —
  see §5 and `AuthController.login`); `GET`/`PATCH` require `Role.ADMIN` or
  `Role.COORDINATOR`.
- **Spam handling is silent, not a rejection.** `SpamGuardService` (a honeypot field plus a
  minimum-fill-time check by default) never causes the public endpoint to error — a
  submission that fails it is still persisted, just as `SPAM` instead of `NEW`, and still
  answers with the same success response. Telling a bot its submission was rejected only
  teaches it to adapt; this keeps a record and an audit trail without giving that signal
  away. The guard is bound via DI (`{ provide: SpamGuardService, useClass:
  HeuristicSpamGuardService }`) specifically so a real reCAPTCHA/hCaptcha-backed
  implementation can replace it later without touching the controller.
- **Marketing content itself is not database-backed.** Hero copy, benefit lists, the
  services catalog, etc. live as static, typed data in the Angular frontend
  (`src/app/features/marketing/content/*.content.ts`), not as a `PlatformPage`/
  `PlatformSection` model — there is no requirement yet for anyone to edit this content
  without a code change, and building that CRUD/UI now would be speculative.

**The seeded tenant's slug was renamed from `default` to `albaz`** so Albaz — the platform's
first client — has a real, human public address (`/albaz`) rather than a placeholder,
without any special-casing: Albaz is created and stored exactly like any other tenant would
be. This was a data migration (`prisma/migrations/20260919091500_rename_default_tenant_slug_to_albaz/`),
not a `prisma/seed.ts` constant change alone — the seed script's tenant lookup is keyed on
its `TENANT_SLUG` constant, so changing that constant against an *already-seeded* database
would create a second tenant rather than rename the first. The migration reuses the existing
`TenantSlugHistory` mechanism (§4), so a link already shared as `/default` still resolves and
redirects via `X-Tenant-Slug-Current`.

---

## 14. Avatars, section visibility, and the client dashboard

### Avatars: always present, never a client-supplied SVG

Every `Person` has a usable `avatar` at all times — `avatarSource` (`DEFAULT | CUSTOM`)
records which kind it currently is, never both, never neither:

```
DEFAULT → avatar = the platform's built-in default-avatar.svg (public/assets/, static, committed)
CUSTOM  → avatar = a URL returned by StorageService.upload() for a file this client uploaded
```

`avatar.controller.ts` (`GET/POST/DELETE tenant/profile/avatar`) is the only way this
changes. Upload only accepts `image/jpeg`, `image/png`, `image/webp` — **SVG is rejected
outright**, even though the platform serves one itself: an uploaded SVG is untrusted content
that can carry active markup (`<script>`, external `<image>` references), while the
committed default is authored by the platform and never touched by client input. The
extension is cross-checked against the declared content type (`photo.png` claiming
`image/jpeg` is rejected) as a second, cheap check beyond the MIME type alone. Max size is
`MAX_AVATAR_SIZE_MB` (default 5), read once in `avatar.controller.ts` at class-load time,
not hardcoded per call site.

**Upload-before-delete.** A replacement is written via `StorageService.upload()`, the
`Person` row is updated to point at it, and *only then* is the previous CUSTOM file deleted.
If the upload step fails, the old avatar is untouched — the profile is never left without
one. `Person.avatarStorageKey` (never exposed in any DTO) is what makes the old file
findable for deletion; it is intentionally **not** derived by parsing the old avatar URL; a
future non-local `StorageService` implementation is free to use a URL shape that has nothing
in common with its object key.

### `StorageService`: local disk today, swappable later

```typescript
abstract class StorageService {
  abstract upload(input: UploadInput): Promise<{ url: string; key: string }>;
  abstract delete(key: string): Promise<void>;
}
```

`LocalStorageService` (the only implementation, bound in `StorageModule`, `@Global()`) writes
under `public/uploads/`, which `main.ts` serves via `useStaticAssets` alongside the committed
`public/assets/`. `public/uploads/` is gitignored — these are runtime files. Swapping in an
S3-compatible provider later is a new class plus one line in `StorageModule`; nothing that
calls `StorageService` needs to change, because callers only ever hold a `{ url, key }` pair,
never a filesystem path.

### Section visibility: `ClientSection`, not array columns

`WebsiteSettings.visibleSections`/`sectionOrder` (string arrays) were removed — reading
`public.service.ts` before this feature showed they were copied into the response as inert
metadata and never used to filter anything. `ClientSection` (one row per tenant per
`section-registry.ts` key) replaces them: a single-row `PATCH tenant/sections/:sectionKey`
toggles one section without a read-modify-write of a whole array, and
`PATCH tenant/sections/reorder` takes the full set transactionally.

`section-registry.ts` intentionally does **not** use the original spec's suggested
`hero`/`about`/`social` keys — this frontend's tenant home page already combines hero+about
into one page, and social links render inside Contact rather than as a separate route. The
real, separately-meaningful keys are `profile, experience, projects, skills, achievements,
courses, timeline, management, contact` — which happen to exactly match `WebsiteSettings`'
old array defaults, so the migration backfill was a clean 1:1 mapping.

**Filtering happens once, on the server, in `PublicProfileService.buildProfile()`** — never
on the frontend. The public response carries both signals, deliberately redundant with each
other:

```jsonc
{
  "sections": { "profile": true, "projects": false, ... }, // sectionKey -> enabled, for building nav
  "projects": []                                            // AND the content itself is emptied
}
```

A disabled section's key is never *omitted* from `sections` (so the frontend can still render
a consistent nav structure) but its content array (or `contact`, which becomes `null`) is
always empty when disabled — a client cannot rely on the frontend to hide something the API
still hands over. Item-level visibility (`Experience.isPublished` etc., pre-existing) and
section-level visibility (`ClientSection.enabled`) compose: a disabled section is empty
regardless of item flags, and an enabled section still respects each item's own
`isPublished`.

### Profile-level publish switch

`Tenant.isPublished` (`tenant/publish-status`, CLIENT-only) is the client's own "is my site
live" switch, deliberately separate from the admin-controlled `Tenant.status` — both are
folded into the same `TenantAccessService.isPubliclyAccessible()` decision (§6), with the
same 404-not-403 treatment: an unpublished profile is indistinguishable from one that was
never registered at that slug.

### The dashboard: one call, not eight

`GET tenant/dashboard` assembles tenant/person/publicSite/appearance/sections/statistics in a
single response, replacing what the Angular client dashboard used to build from eight
separate content-count requests. `publicSite.url` is built server-side from
`FRONTEND_PUBLIC_URL` + the tenant's slug — the frontend renders it as a link
(`target="_blank" rel="noopener noreferrer"`) rather than constructing the URL itself, so the
platform's public URL shape lives in exactly one place.
