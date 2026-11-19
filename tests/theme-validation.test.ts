// The stored theme name → ThemeName rule. This suite used to test a copy of the
// rule pasted into the test; since ADR-018 it tests the real one
// (lib/appearance.ts resolveStoredTheme), which the settings store's one-time
// migration applies to the v1.2.0 'dita-architect-theme' key.
import { describe, it, expect } from 'vitest';
import { resolveStoredTheme, THEME_OPTIONS, migrateThemePair } from '../lib/appearance';

describe('resolveStoredTheme — a stored theme name', () => {
  it.each(['light', 'claude', 'nord', 'solarized', 'navy', 'dark'])('accepts %s', (t) => {
    expect(resolveStoredTheme(t)).toBe(t);
  });

  it.each([['invalid'], [''], ['NAVY'], ['Light'], ['Dark'], ['geo'], ['tablet'], ['darkmode'], ['corrupted-theme-name']])('rejects %j and falls back to dark', (t) => {
    expect(resolveStoredTheme(t)).toBe('dark');
  });

  it('a missing value (first visit) is dark', () => {
    expect(resolveStoredTheme(null)).toBe('dark');
  });

  it('accepts exactly the themes in THEME_OPTIONS', () => {
    for (const { value } of THEME_OPTIONS) expect(resolveStoredTheme(value)).toBe(value);
  });
});

describe('the stored theme reaches the active profile (the migration\'s use of the rule)', () => {
  it('a stored navy lands on the Navy built-in; a corrupted name on Dark', () => {
    expect(migrateThemePair('navy', null).activeProfileId).toBe('builtin:navy');
    expect(migrateThemePair('corrupted-theme-name', null).activeProfileId).toBe('builtin:dark');
  });
});
