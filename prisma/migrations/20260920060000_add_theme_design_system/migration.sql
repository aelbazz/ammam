-- Adds the design-system identifier to a tenant's theme, alongside the existing `layout`
-- column. Both are validated against a code-level registry (design-registry.ts), not a DB
-- enum, so a new design system or layout never needs a migration - see
-- docs/SAAS-ARCHITECTURE.md.

ALTER TABLE "tenant_theme" ADD COLUMN "design_system" TEXT NOT NULL DEFAULT 'modern';
