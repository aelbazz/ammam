-- Replaces TenantTheme.darkMode (stored but never read anywhere to actually change
-- rendering) with themeMode, a registry-validated plain string exactly mirroring
-- designSystem/layout's existing pattern - a String rather than a DB enum specifically so a
-- future 'system'/'auto' value never needs a migration to add.

-- AlterTable
ALTER TABLE "tenant_theme" ADD COLUMN "theme_mode" TEXT NOT NULL DEFAULT 'light';

-- Backfill every existing tenant's explicit choice before the column it came from is dropped.
UPDATE "tenant_theme" SET "theme_mode" = CASE WHEN "dark_mode" THEN 'dark' ELSE 'light' END;

-- AlterTable
ALTER TABLE "tenant_theme" DROP COLUMN "dark_mode";
