-- Multi-tenant SaaS platform layer.
--
-- Introduces Tenant (the account: UUID id, public slug, lifecycle status), User (replaces
-- admin_user with a role: ADMIN | COORDINATOR | CLIENT), billing (Plan/Subscription/
-- Payment), audit logging, and per-tenant Theme/WebsiteSettings. The existing profile
-- domain (Person, Experience, Project, ...) is untouched below Person: Person now belongs
-- to a Tenant instead of being one, and every personId-scoped query in the application
-- keeps working unchanged - see docs/SAAS-ARCHITECTURE.md.
--
-- admin_user and person.slug already hold data, so this cannot be a clean
-- drop-and-recreate: it creates the new tables, backfills a Tenant + User per existing
-- Person/AdminUser (joined on the now-retired person.slug, which becomes tenant.slug),
-- gives each backfilled tenant a default Plan/Subscription/Theme/WebsiteSettings, and only
-- then drops admin_user and person.slug. A plain destructive migration would lose every
-- existing account and profile.

-- ===========================================================================
-- 1. New enum types
-- ===========================================================================

-- CreateEnum
CREATE TYPE "role" AS ENUM ('ADMIN', 'COORDINATOR', 'CLIENT');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "tenant_status" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "billing_interval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- ===========================================================================
-- 2. New tables (empty at this point - backfilled below)
-- ===========================================================================

-- CreateTable
CREATE TABLE "tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "tenant_status" NOT NULL DEFAULT 'PENDING',
    "created_by_id" TEXT,
    "coordinator_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_slug_history" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_slug_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "role" "role" NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'active',
    "tenant_id" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'TRIAL',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "renewal_date" TIMESTAMP(3),
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billing_interval" "billing_interval" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "features" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "provider_transaction_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_role" TEXT,
    "tenant_id" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_theme" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "primary_color" TEXT NOT NULL DEFAULT '#6366f1',
    "secondary_color" TEXT NOT NULL DEFAULT '#64748b',
    "accent_color" TEXT NOT NULL DEFAULT '#06b6d4',
    "background_color" TEXT NOT NULL DEFAULT '#ffffff',
    "text_color" TEXT NOT NULL DEFAULT '#334155',
    "heading_color" TEXT NOT NULL DEFAULT '#0f172a',
    "font_family" TEXT NOT NULL DEFAULT 'Inter, sans-serif',
    "border_radius" TEXT NOT NULL DEFAULT '0.5rem',
    "layout" TEXT NOT NULL DEFAULT 'classic',
    "dark_mode" BOOLEAN NOT NULL DEFAULT false,
    "custom_css" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "website_title" TEXT NOT NULL,
    "description" TEXT,
    "favicon_url" TEXT,
    "logo_url" TEXT,
    "visible_sections" TEXT[] DEFAULT ARRAY['profile', 'experience', 'projects', 'skills', 'achievements', 'courses', 'timeline', 'management', 'contact']::TEXT[],
    "section_order" TEXT[] DEFAULT ARRAY['profile', 'experience', 'projects', 'skills', 'achievements', 'courses', 'timeline', 'management', 'contact']::TEXT[],
    "seo_title" TEXT,
    "seo_description" TEXT,
    "og_image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_settings_pkey" PRIMARY KEY ("id")
);

-- ===========================================================================
-- 3. person.tenant_id: added NULLABLE first. A NOT NULL column cannot be added to a
--    populated table without a backfill in between - see step 4.
-- ===========================================================================
ALTER TABLE "person" ADD COLUMN "tenant_id" TEXT;

-- ===========================================================================
-- 4. Backfill: one Tenant per existing Person, one User per existing AdminUser.
--
--    The join key is person.slug, which is about to be dropped (step 6) - it is exactly
--    the value tenant.slug takes over, so this is the one moment both meanings of "slug"
--    exist side by side and can be tied together.
-- ===========================================================================

-- 4a. One Tenant per existing Person. Marked ACTIVE (not the normal PENDING default) since
--     these profiles are already live in production, not awaiting onboarding.
INSERT INTO "tenant" ("id", "slug", "name", "status", "created_at", "updated_at")
SELECT gen_random_uuid()::text, p."slug", p."name", 'ACTIVE'::"tenant_status", p."created_at", p."updated_at"
FROM "person" p;

-- 4b. Link each Person back to its new Tenant via the shared slug value.
UPDATE "person" SET "tenant_id" = t."id"
FROM "tenant" t
WHERE t."slug" = "person"."slug";

-- 4c. Every Person must now have a tenant - fail loudly rather than silently leaving one
--     unlinked if the slug join somehow missed a row.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "person" WHERE "tenant_id" IS NULL) THEN
    RAISE EXCEPTION 'Migration aborted: at least one person row failed to backfill a tenant_id';
  END IF;
END $$;

ALTER TABLE "person" ALTER COLUMN "tenant_id" SET NOT NULL;

-- 4d. One User (role CLIENT) per existing AdminUser, on the Tenant its Person now points
--     at. The id is carried over from admin_user so nothing needs remapping.
INSERT INTO "user" ("id", "email", "password_hash", "name", "role", "status", "tenant_id", "last_login_at", "created_at", "updated_at")
SELECT au."id", au."email", au."password_hash", au."name", 'CLIENT'::"role",
       CASE WHEN au."is_active" THEN 'active' ELSE 'suspended' END::"user_status",
       p."tenant_id", au."last_login_at", au."created_at", au."updated_at"
FROM "admin_user" au
JOIN "person" p ON p."id" = au."person_id";

-- 4e. A default Plan for the backfilled subscriptions to reference. Fixed id so it is
--     addressable/idempotent if this migration is ever replayed against a fresh shadow db.
INSERT INTO "plan" ("id", "name", "description", "price", "currency", "billing_interval", "active", "features", "created_at", "updated_at")
VALUES ('plan_free_default', 'Free', 'Default plan assigned to profiles migrated into the multi-tenant platform.', 0, 'USD', 'MONTHLY'::"billing_interval", true, '[]'::jsonb, now(), now())
ON CONFLICT ("id") DO NOTHING;

-- 4f. Backfilled tenants get an ACTIVE subscription on that plan - they are already live,
--     so a fresh migration must not suddenly gate them behind a trial/expiry check.
INSERT INTO "subscription" ("id", "tenant_id", "plan_id", "status", "started_at", "auto_renew", "created_at", "updated_at")
SELECT gen_random_uuid()::text, t."id", 'plan_free_default', 'ACTIVE'::"subscription_status", t."created_at", false, t."created_at", t."updated_at"
FROM "tenant" t;

-- 4g. Default theme per tenant - every column below has a schema default, so only the
--     required identity columns need a value.
INSERT INTO "tenant_theme" ("id", "tenant_id", "created_at", "updated_at")
SELECT gen_random_uuid()::text, t."id", now(), now()
FROM "tenant" t;

-- 4h. Default website settings per tenant. website_title has no schema default (it is a
--     required field at signup time going forward), so the tenant name fills it here.
INSERT INTO "website_settings" ("id", "tenant_id", "website_title", "created_at", "updated_at")
SELECT gen_random_uuid()::text, t."id", t."name", now(), now()
FROM "tenant" t;

-- ===========================================================================
-- 5. admin_user is fully superseded by user - drop it now that every row has been copied.
-- ===========================================================================

-- DropForeignKey
ALTER TABLE "admin_user" DROP CONSTRAINT "admin_user_person_id_fkey";

-- DropTable
DROP TABLE "admin_user";

-- ===========================================================================
-- 6. Drop person.slug now that tenant.slug is the public identifier, and the old unique
--    index that enforced it.
-- ===========================================================================

-- DropIndex
DROP INDEX "person_slug_key";

ALTER TABLE "person" DROP COLUMN "slug";

-- ===========================================================================
-- 7. Indexes and foreign keys. Deferred to the end: by now every table is populated
--    consistently, so unique/FK constraints validate cleanly against real data instead of
--    racing the backfill above.
-- ===========================================================================

-- CreateIndex
CREATE UNIQUE INDEX "tenant_slug_key" ON "tenant"("slug");

-- CreateIndex
CREATE INDEX "tenant_status_idx" ON "tenant"("status");

-- CreateIndex
CREATE INDEX "tenant_coordinator_id_idx" ON "tenant"("coordinator_id");

-- CreateIndex
CREATE INDEX "tenant_created_by_id_idx" ON "tenant"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_slug_history_slug_key" ON "tenant_slug_history"("slug");

-- CreateIndex
CREATE INDEX "tenant_slug_history_tenant_id_idx" ON "tenant_slug_history"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_tenant_id_key" ON "user"("tenant_id");

-- CreateIndex
CREATE INDEX "user_role_idx" ON "user"("role");

-- CreateIndex
CREATE INDEX "user_tenant_id_idx" ON "user"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_tenant_id_key" ON "subscription"("tenant_id");

-- CreateIndex
CREATE INDEX "subscription_status_idx" ON "subscription"("status");

-- CreateIndex
CREATE INDEX "subscription_renewal_date_idx" ON "subscription"("renewal_date");

-- CreateIndex
CREATE UNIQUE INDEX "plan_name_key" ON "plan"("name");

-- CreateIndex
CREATE INDEX "payment_tenant_id_idx" ON "payment"("tenant_id");

-- CreateIndex
CREATE INDEX "payment_subscription_id_idx" ON "payment"("subscription_id");

-- CreateIndex
CREATE INDEX "payment_status_idx" ON "payment"("status");

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_idx" ON "audit_log"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log"("actor_id");

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "audit_log"("action");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_theme_tenant_id_key" ON "tenant_theme"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "website_settings_tenant_id_key" ON "website_settings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "person_tenant_id_key" ON "person"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_slug_history" ADD CONSTRAINT "tenant_slug_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_theme" ADD CONSTRAINT "tenant_theme_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_settings" ADD CONSTRAINT "website_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "person_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
