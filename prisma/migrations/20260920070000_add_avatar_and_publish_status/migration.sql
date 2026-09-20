-- Adds avatar provenance to Person (so the frontend can tell a real upload apart from the
-- platform's built-in default SVG) and a client-owned publish switch on Tenant, distinct
-- from the admin-controlled `status` - see docs/SAAS-ARCHITECTURE.md.

-- CreateEnum
CREATE TYPE "avatar_source" AS ENUM ('DEFAULT', 'CUSTOM');

-- AlterTable
ALTER TABLE "person" ADD COLUMN "avatar_source" "avatar_source" NOT NULL DEFAULT 'DEFAULT';
ALTER TABLE "person" ADD COLUMN "avatar_updated_at" TIMESTAMP(3);

-- Every existing row already carries a real, specifically-chosen avatar path set before this
-- feature existed - categorize those as CUSTOM, not the new DEFAULT placeholder.
UPDATE "person" SET "avatar_source" = 'CUSTOM';

-- AlterTable
ALTER TABLE "tenant" ADD COLUMN "is_published" BOOLEAN NOT NULL DEFAULT true;
