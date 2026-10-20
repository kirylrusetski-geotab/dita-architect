// FR-061 — the "geotab" theme was renamed "navy". A stored legacy preference
// must resolve to the new name so existing users keep their palette; the
// hook's initializer also rewrites localStorage (covered by inspection of
// useEditorUi; the pure resolver is pinned here).
import { describe, it, expect } from 'vitest';
import { resolveStoredTheme } from '../hooks/useEditorUi';
import { THEME_OPTIONS, THEME_DESCRIPTIONS } from '../components/Toolbar';

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
