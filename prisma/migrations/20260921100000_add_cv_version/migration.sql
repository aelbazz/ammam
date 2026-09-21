-- One row per saved CV configuration. All versions read the SAME live Person/Experience/
-- Project/... data at generate time - nothing here duplicates profile content, see
-- src/cv/cv-builder.service.ts. Every tenant gets exactly one default version: backfilled
-- below for existing tenants, seeded going forward in TenantService.create() (mirrors
-- ClientSection's own onboarding + backfill).

-- CreateTable
CREATE TABLE "cv_version" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "template_id" TEXT NOT NULL DEFAULT 'ATS_CLASSIC',
    "cv_title" TEXT,
    "cv_summary" TEXT,
    "include_phone" BOOLEAN NOT NULL DEFAULT true,
    "include_email" BOOLEAN NOT NULL DEFAULT true,
    "include_linkedin" BOOLEAN NOT NULL DEFAULT true,
    "include_github" BOOLEAN NOT NULL DEFAULT true,
    "include_portfolio" BOOLEAN NOT NULL DEFAULT true,
    "include_management" BOOLEAN NOT NULL DEFAULT true,
    "section_config" JSONB NOT NULL DEFAULT '[]',
    "excluded_experience_ids" JSONB NOT NULL DEFAULT '[]',
    "excluded_project_ids" JSONB NOT NULL DEFAULT '[]',
    "experience_order" JSONB,
    "project_order" JSONB,
    "target_role" TEXT,
    "job_description" TEXT,
    "target_company" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cv_version_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "cv_version" ADD CONSTRAINT "cv_version_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "cv_version_person_id_idx" ON "cv_version"("person_id");

-- CreateIndex
-- Partial unique index: at most one default version per person - DB-enforced, not just an
-- application convention. Not expressible in schema.prisma's DSL (no WHERE-qualified
-- @@unique), so it exists only here.
CREATE UNIQUE INDEX "cv_version_person_id_default_key" ON "cv_version"("person_id") WHERE "is_default";

-- Backfill: every existing person gets one default "General CV" with every section enabled
-- in the canonical order, so the public CV download button and the CV Builder both work
-- immediately with no manual setup step.
INSERT INTO "cv_version" ("id", "person_id", "name", "is_default", "section_config", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  p."id",
  'General CV',
  true,
  '[{"key":"experience","enabled":true},{"key":"skills","enabled":true},{"key":"projects","enabled":true},{"key":"education","enabled":true},{"key":"courses","enabled":true},{"key":"achievements","enabled":true}]'::jsonb,
  now(),
  now()
FROM "person" p;
