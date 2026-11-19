// FR-061 — the "geotab" theme was renamed "navy". A stored legacy preference
// must resolve to the new name so existing users keep their palette. Since
// v1.3.0 the settings store's one-time migration applies it (ADR-018 decision 8).
import { describe, it, expect } from 'vitest';
// ADR-018: the resolver moved with the theme names to lib/appearance.ts; the settings
// store's migration (tests/settings-store.test.ts) is what calls it now.
import { resolveStoredTheme, THEME_OPTIONS, THEME_DESCRIPTIONS } from '../lib/appearance';

describe('FR-061: theme rename geotab → navy', () => {
  it('maps the legacy stored value to navy', () => {
    expect(resolveStoredTheme('geotab')).toBe('navy');
  });

  it('accepts every current theme name unchanged', () => {
    for (const { value } of THEME_OPTIONS) expect(resolveStoredTheme(value)).toBe(value);
  });

  it('falls back to dark for unknown or missing values', () => {
    expect(resolveStoredTheme(null)).toBe('dark');
    expect(resolveStoredTheme('')).toBe('dark');
    expect(resolveStoredTheme('GEOTAB')).toBe('dark');
    expect(resolveStoredTheme('altitude')).toBe('dark');
  });

  it('no user-visible theme string carries the company name', () => {
    for (const { value, label } of THEME_OPTIONS) {
      expect(value.toLowerCase()).not.toContain('geotab');
      expect(label.toLowerCase()).not.toContain('geotab');
      expect(THEME_DESCRIPTIONS[value].toLowerCase()).not.toContain('geotab');
    }
    expect(THEME_DESCRIPTIONS.navy).toBe('Deep blue-navy palette for low-light work');
  });
});
