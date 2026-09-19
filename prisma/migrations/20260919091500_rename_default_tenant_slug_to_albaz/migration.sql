-- Renames the seeded tenant's slug from "default" to "albaz": Albaz becomes an ordinary
-- tenant identified by a real human slug, not a placeholder baked into the platform - see
-- docs/SAAS-ARCHITECTURE.md. Uses the existing tenant_slug_history mechanism
-- (PublicProfileService.resolveBySlug already falls back through it) so a link already
-- shared as /default keeps resolving, with X-Tenant-Slug-Current in the response pointing
-- callers at the new slug.
--
-- Not done by editing prisma/seed.ts's TENANT_SLUG constant alone: that upsert is keyed on
-- `where: { slug: TENANT_SLUG }`, so on an already-seeded database, simply changing the
-- constant would look up a tenant slugged "albaz" (not found) and CREATE a second tenant +
-- person rather than rename the existing one.

-- Preserve the retiring slug in history before the rename overwrites it. WHERE-guarded so
-- this is a no-op (no matching row) if the tenant has already been renamed or never existed
-- under "default" (e.g. a fresh database seeded directly with TENANT_SLUG = 'albaz').
INSERT INTO "tenant_slug_history" ("id", "tenant_id", "slug", "created_at")
SELECT gen_random_uuid()::text, "id", 'default', now()
FROM "tenant"
WHERE "slug" = 'default';

-- Rename the live slug.
UPDATE "tenant"
SET "slug" = 'albaz'
WHERE "slug" = 'default';
