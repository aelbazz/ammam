-- Multi-tenancy: every profile becomes a tenant.
--
-- admin_user and technology gain person_id. Both tables already hold rows, so the column is
-- added nullable, backfilled from the existing profile, and only then made NOT NULL - a
-- plain "ADD COLUMN ... NOT NULL" would abort on a populated table.
--
-- The backfill assumes a single pre-existing profile, which is what a single-tenant
-- deployment has by definition. If more than one person row exists the statements below
-- will fail rather than guess, which is the safe outcome.

-- DropIndex
DROP INDEX "achievement_legacy_id_key";

-- DropIndex
DROP INDEX "course_legacy_id_key";

-- DropIndex
DROP INDEX "experience_legacy_id_key";

-- DropIndex
DROP INDEX "mgmt_role_legacy_id_key";

-- DropIndex
DROP INDEX "project_legacy_id_key";

-- DropIndex
DROP INDEX "technology_name_key";

-- DropIndex
DROP INDEX "technology_slug_key";

-- DropIndex
DROP INDEX "timeline_event_legacy_id_key";

-- AlterTable: admin_user.person_id (nullable -> backfill -> NOT NULL)
ALTER TABLE "admin_user" ADD COLUMN "person_id" TEXT;

UPDATE "admin_user"
SET "person_id" = (SELECT "id" FROM "person" ORDER BY "created_at" ASC LIMIT 1)
WHERE "person_id" IS NULL;

ALTER TABLE "admin_user" ALTER COLUMN "person_id" SET NOT NULL;

-- AlterTable: technology.person_id (nullable -> backfill -> NOT NULL)
--
-- Technologies were global before this migration. Each existing row is assigned to the
-- single existing profile; from here on they are per-tenant.
ALTER TABLE "technology" ADD COLUMN "person_id" TEXT;

UPDATE "technology"
SET "person_id" = (SELECT "id" FROM "person" ORDER BY "created_at" ASC LIMIT 1)
WHERE "person_id" IS NULL;

ALTER TABLE "technology" ALTER COLUMN "person_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "achievement_person_id_legacy_id_key" ON "achievement"("person_id", "legacy_id");

-- CreateIndex
CREATE INDEX "admin_user_person_id_idx" ON "admin_user"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_person_id_legacy_id_key" ON "course"("person_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "experience_person_id_legacy_id_key" ON "experience"("person_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "mgmt_role_person_id_legacy_id_key" ON "mgmt_role"("person_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_person_id_legacy_id_key" ON "project"("person_id", "legacy_id");

-- CreateIndex
CREATE INDEX "technology_person_id_idx" ON "technology"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "technology_person_id_slug_key" ON "technology"("person_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "technology_person_id_name_key" ON "technology"("person_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "timeline_event_person_id_legacy_id_key" ON "timeline_event"("person_id", "legacy_id");

-- AddForeignKey
ALTER TABLE "technology" ADD CONSTRAINT "technology_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_user" ADD CONSTRAINT "admin_user_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

