/**
 * The platform's design-system and layout catalog. Adding a new design system or layout
 * later is a code change here, never a migration - this is the "registry, not a hardcoded
 * DB enum" the architecture calls for. TenantTheme.designSystem/layout are validated against
 * this in ThemeService, not via class-validator, since the valid set is defined here.
 */
export interface DesignSystemDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Layout ids this design system supports. A tenant cannot pair a design system with a
   *  layout outside this list - see ThemeService.update() and isCompatible() below. */
  readonly layouts: readonly string[];
}

export interface LayoutDefinition {
  readonly id: string;
  readonly label: string;
}

export const LAYOUTS: readonly LayoutDefinition[] = [
  { id: 'classic', label: 'Classic (top navigation)' },
  { id: 'sidebar', label: 'Sidebar navigation' },
];

export const DESIGN_SYSTEMS: readonly DesignSystemDefinition[] = [
  {
    id: 'modern',
    label: 'Modern Professional',
    description: 'Clean, minimal, business-friendly presentation.',
    layouts: ['classic', 'sidebar'],
  },
  {
    id: 'creative',
    label: 'Creative Portfolio',
    description: 'Bold colors and expressive typography, built around the sidebar layout.',
    layouts: ['sidebar'],
  },
];

export function isValidDesignSystem(id: string): boolean {
  return DESIGN_SYSTEMS.some((d) => d.id === id);
}

export function isValidLayout(id: string): boolean {
  return LAYOUTS.some((l) => l.id === id);
}

export function isCompatible(designSystemId: string, layoutId: string): boolean {
  const designSystem = DESIGN_SYSTEMS.find((d) => d.id === designSystemId);
  return designSystem ? designSystem.layouts.includes(layoutId) : false;
}
