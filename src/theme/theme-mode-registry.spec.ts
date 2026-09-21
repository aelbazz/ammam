import { isValidThemeMode, THEME_MODES } from './theme-mode-registry';

describe('theme-mode-registry', () => {
  it('lists exactly light and dark today', () => {
    expect(THEME_MODES).toEqual(['light', 'dark']);
  });

  it('validates known modes', () => {
    expect(isValidThemeMode('light')).toBe(true);
    expect(isValidThemeMode('dark')).toBe(true);
  });

  it('rejects unknown or malformed modes, case-sensitively', () => {
    expect(isValidThemeMode('LIGHT')).toBe(false);
    expect(isValidThemeMode('dark-mode')).toBe(false);
    expect(isValidThemeMode('night')).toBe(false);
    expect(isValidThemeMode('blue')).toBe(false);
    expect(isValidThemeMode('')).toBe(false);
  });
});
