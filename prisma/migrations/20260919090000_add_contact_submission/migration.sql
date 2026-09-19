-- Adds the "contact us" inbox for the Portfolio marketing site (the platform's own
-- /contact page), distinct from the existing per-tenant "contact" table (a tenant's own
-- published contact info). Platform-level, so no tenant_id - see schema.prisma doc comment
-- on ContactSubmission and docs/SAAS-ARCHITECTURE.md.
--
-- New empty table - no backfill needed.

-- CreateEnum
CREATE TYPE "contact_submission_status" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'SPAM');

-- CreateTable
CREATE TABLE "contact_submission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "contact_submission_status" NOT NULL DEFAULT 'NEW',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_submission_status_idx" ON "contact_submission"("status");

-- CreateIndex
CREATE INDEX "contact_submission_created_at_idx" ON "contact_submission"("created_at");

-- CreateIndex
CREATE INDEX "contact_submission_email_idx" ON "contact_submission"("email");

-- AddForeignKey
ALTER TABLE "contact_submission" ADD CONSTRAINT "contact_submission_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
