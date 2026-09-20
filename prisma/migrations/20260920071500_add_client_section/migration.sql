-- Replaces WebsiteSettings.visibleSections/sectionOrder (string arrays that were never
-- actually enforced anywhere - confirmed by reading public.service.ts, which only copied
-- them into the response as inert metadata) with a real, normalized table: one row per
-- section per tenant, so a single section's enabled flag or a bulk reorder are both a
-- straightforward write instead of a read-modify-write of a whole array. See
-- section-registry.ts and docs/SAAS-ARCHITECTURE.md.

-- CreateTable
CREATE TABLE "client_section" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "section_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_section_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_section_tenant_id_section_key_key" ON "client_section"("tenant_id", "section_key");

-- CreateIndex
CREATE INDEX "client_section_tenant_id_display_order_idx" ON "client_section"("tenant_id", "display_order");

-- AddForeignKey
ALTER TABLE "client_section" ADD CONSTRAINT "client_section_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill one row per existing tenant, per key that was in its old section_order array.
-- unnest(...) WITH ORDINALITY gives each key its 1-based position for display_order;
-- enabled reflects whether that same key was also present in visible_sections.
INSERT INTO "client_section" ("id", "tenant_id", "section_key", "enabled", "display_order", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  ws."tenant_id",
  ordered.section_key,
  ordered.section_key = ANY(ws."visible_sections"),
  ordered.ord,
  now(),
  now()
FROM "website_settings" ws
CROSS JOIN LATERAL unnest(ws."section_order") WITH ORDINALITY AS ordered(section_key, ord);

-- AlterTable
ALTER TABLE "website_settings" DROP COLUMN "visible_sections";
ALTER TABLE "website_settings" DROP COLUMN "section_order";
