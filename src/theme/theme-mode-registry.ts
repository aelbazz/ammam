/**
 * Valid values for TenantTheme.themeMode and UserPreference.themeMode. A plain string list,
 * not a DB enum, so a future 'system' value never needs a migration - see design-registry.ts
 * for the same reasoning applied to designSystem/layout.
 *
 * 'system' is a planned future addition (resolved client-side via
 * window.matchMedia('(prefers-color-scheme: dark)')) - deliberately not added yet, since
 * nothing here resolves it server-side and an unresolved 'system' value stored against a
 * tenant would break every consumer expecting a concrete 'light'|'dark'.
 */
export const THEME_MODES: readonly string[] = ['light', 'dark'];

export function isValidThemeMode(mode: string): boolean {
  return THEME_MODES.includes(mode);
}
