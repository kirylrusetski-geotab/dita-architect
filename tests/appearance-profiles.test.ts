// @vitest-environment jsdom
//
// ADR-018 — the profile model (lib/appearance.ts): built-ins, applying a
// profile (A1's no-leak half, A3), editing, deleting, export/import (A4), the
// value check (decision 4), and the stored theme pair → profile migration (A2's
// pure half; the store's half is tests/settings-store.test.ts).
import { describe, it, expect, beforeEach } from 'vitest';
import { APPEARANCE_VAR_NAMES } from '../constants/appearance-vars';
import {
  THEME_OPTIONS, SYNTAX_THEME_OPTIONS, THEME_VALUES, BUILT_IN_PROFILES, DEFAULT_APPEARANCE,
  builtInId, allProfiles, resolveActiveProfile, applyProfile, duplicateProfile, updateProfile,
  setOverride, resetOverrides, deleteProfile, setActiveProfile, exportProfile, importProfile,
  isValidValue, parseColour, withAlpha, migrateThemePair, parseStoredAppearance, resolveStoredTheme,
  syntaxModeMismatch, builtInDescription,
  type AppearanceState,
} from '../lib/appearance';

const html = () => document.documentElement;
const inlineVars = () => {
  const out: string[] = [];
  for (let i = 0; i < html().style.length; i++) {
    const p = html().style.item(i);
    if (p.startsWith('--')) out.push(p);
  }
  return out;
};

beforeEach(() => {
  html().removeAttribute('data-theme');
  html().removeAttribute('style');
});

describe('decision 1 — read-only built-ins: one per theme, then the palettes', () => {
  it('one per theme, in theme order, with the agreed syntax pairing (Light → Daylight, the rest → Material), then Warm paper', () => {
    expect(BUILT_IN_PROFILES.map(p => [p.id, p.name, p.base, p.syntaxTheme, p.builtIn])).toEqual([
      ['builtin:dark', 'Dark', 'dark', 'material', true],
      ['builtin:light', 'Light', 'light', 'daylight', true],
      ['builtin:claude', 'Claude', 'claude', 'material', true],
      ['builtin:nord', 'Nord', 'nord', 'material', true],
      ['builtin:solarized', 'Solarized', 'solarized', 'material', true],
      ['builtin:navy', 'Navy', 'navy', 'material', true],
      ['builtin:warm-paper', 'Warm paper', 'light', 'daylight', true],
    ]);
    for (const p of BUILT_IN_PROFILES.slice(0, 6)) expect(p.overrides).toEqual({});
  });

  it('Warm paper is Light plus four colours (Kiryl\'s pick from the mock), every value valid and different from Light\'s', () => {
    const wp = BUILT_IN_PROFILES.find(p => p.id === 'builtin:warm-paper')!;
    expect(wp.overrides).toEqual({ '--editor-canvas-bg': '#efe6d6', '--editor-page-bg': '#fffaf0', '--editor-h1': '#3b2a1a', '--editor-accent': '#b45309' });
    for (const [k, v] of Object.entries(wp.overrides)) {
      expect(isValidValue(k as never, v!)).toBe(true);
      expect(THEME_VALUES.light[k as keyof typeof THEME_VALUES.light]).not.toBe(v);
    }
    expect(builtInDescription(wp)).toMatch(/warm paper/);
    expect(builtInDescription(BUILT_IN_PROFILES[0])).toBe('High contrast for low-light work');
  });

  it('a palette built-in is read-only too, and its duplicate starts with its colours', () => {
    expect(setOverride(DEFAULT_APPEARANCE, 'builtin:warm-paper', '--app-bg', '#000000')).toBe(DEFAULT_APPEARANCE);
    const s = duplicateProfile(DEFAULT_APPEARANCE, 'builtin:warm-paper', 'p');
    expect(resolveActiveProfile(s)).toMatchObject({ name: 'Warm paper copy', base: 'light', builtIn: false });
    expect(Object.keys(resolveActiveProfile(s).overrides).length).toBe(4);
  });

  it('the default state is the Dark built-in with no custom profiles (a user who never changed anything)', () => {
    expect(DEFAULT_APPEARANCE).toEqual({ activeProfileId: 'builtin:dark', profiles: [] });
    expect(resolveActiveProfile(DEFAULT_APPEARANCE).syntaxTheme).toBe('material');
  });

  it('a built-in cannot be renamed, rebased, overridden or deleted', () => {
    const s = DEFAULT_APPEARANCE;
    expect(updateProfile(s, 'builtin:dark', { name: 'Mine' })).toBe(s);
    expect(setOverride(s, 'builtin:dark', '--app-bg', '#000000')).toBe(s);
    expect(deleteProfile(s, 'builtin:dark')).toBe(s);
  });
});

describe('decision 3 / A1 / A3 — applying a profile', () => {
  it('a theme built-in sets data-theme on <html> and leaves no inline custom property', () => {
    for (const p of BUILT_IN_PROFILES.filter(b => Object.keys(b.overrides).length === 0)) {
      applyProfile(html(), p);
      expect(html().getAttribute('data-theme')).toBe(p.base);
      expect(inlineVars()).toEqual([]);
    }
  });

  it('a custom profile with one override sets exactly that variable inline, over its base', () => {
    let s = duplicateProfile(DEFAULT_APPEARANCE, 'builtin:nord', 'p1');
    s = setOverride(s, 'p1', '--editor-accent', '#ff8800');
    applyProfile(html(), resolveActiveProfile(s));
    expect(html().getAttribute('data-theme')).toBe('nord');
    expect(inlineVars()).toEqual(['--editor-accent']);
    expect(html().style.getPropertyValue('--editor-accent')).toBe('#ff8800');
  });

  it('switching from a custom profile back to a built-in leaves no override behind (no leak)', () => {
    let s = duplicateProfile(DEFAULT_APPEARANCE, 'builtin:dark', 'p1');
    for (const v of ['--app-bg', '--editor-page-bg', '--badge-task-text'] as const) s = setOverride(s, 'p1', v, '#123456');
    applyProfile(html(), resolveActiveProfile(s));
    expect(inlineVars().length).toBe(3);
    applyProfile(html(), resolveActiveProfile(setActiveProfile(s, 'builtin:light')));
    expect(html().getAttribute('data-theme')).toBe('light');
    expect(inlineVars()).toEqual([]);
  });

  it('a style the app did not set (not a registry variable) is left alone', () => {
    html().style.setProperty('--some-other-thing', '1');
    applyProfile(html(), BUILT_IN_PROFILES[0]);
    expect(inlineVars()).toEqual(['--some-other-thing']);
  });
});

describe('editing a custom profile', () => {
  it('duplicate copies base, syntax theme and overrides, picks a unique name, and becomes active', () => {
    let s = duplicateProfile(DEFAULT_APPEARANCE, 'builtin:light', 'a');
    expect(resolveActiveProfile(s)).toMatchObject({ id: 'a', name: 'Light copy', base: 'light', syntaxTheme: 'daylight', builtIn: false });
    s = setOverride(s, 'a', '--editor-h1', '#3b2a1a');
    s = duplicateProfile(s, 'a', 'b');
    expect(resolveActiveProfile(s)).toMatchObject({ id: 'b', name: 'Light copy copy', overrides: { '--editor-h1': '#3b2a1a' } });
    s = duplicateProfile(s, 'builtin:light', 'c');
    expect(resolveActiveProfile(s).name).toBe('Light copy 2');
  });

  it('an override equal to the base value is not stored; reset removes one; resetOverrides removes all', () => {
    let s = duplicateProfile(DEFAULT_APPEARANCE, 'builtin:dark', 'a');
    s = setOverride(s, 'a', '--app-bg', THEME_VALUES.dark['--app-bg']);
    expect(resolveActiveProfile(s).overrides).toEqual({});
    s = setOverride(s, 'a', '--app-bg', '#000000');
    s = setOverride(s, 'a', '--app-text-muted', '#777777');
    s = setOverride(s, 'a', '--app-bg', null);
    expect(resolveActiveProfile(s).overrides).toEqual({ '--app-text-muted': '#777777' });
    s = resetOverrides(s, 'a');
    expect(resolveActiveProfile(s).overrides).toEqual({});
  });

  it('an unknown variable or an invalid value changes nothing', () => {
    const s = duplicateProfile(DEFAULT_APPEARANCE, 'builtin:dark', 'a');
    expect(setOverride(s, 'a', '--app-accent-red' as never, '#ff0000')).toBe(s);
    expect(setOverride(s, 'a', '--app-bg', 'url(https://example.com/x.png)')).toBe(s);
    expect(setOverride(s, 'a', '--app-bg', 'red; background: blue')).toBe(s);
  });

  it('rename keeps names unique; an empty name is refused; base and syntax theme change', () => {
    let s = duplicateProfile(DEFAULT_APPEARANCE, 'builtin:dark', 'a');
    s = duplicateProfile(s, 'builtin:dark', 'b');
    s = updateProfile(s, 'b', { name: 'Dark copy' });
    expect(allProfiles(s).find(p => p.id === 'b')!.name).toBe('Dark copy 2');
    expect(updateProfile(s, 'b', { name: '   ' })).toBe(s);
    s = updateProfile(s, 'b', { base: 'solarized', syntaxTheme: 'dracula' });
    expect(allProfiles(s).find(p => p.id === 'b')).toMatchObject({ base: 'solarized', syntaxTheme: 'dracula' });
  });

  it('a light syntax theme on a dark base (and the reverse) is flagged, as the XML split flagged it before', () => {
    expect(syntaxModeMismatch('dark', 'daylight')).toBe(true);
    expect(syntaxModeMismatch('light', 'material')).toBe(true);
    expect(syntaxModeMismatch('light', 'daylight')).toBe(false);
    expect(syntaxModeMismatch('nord', 'dracula')).toBe(false);
  });
});

describe('decision 6 / A3 — deleting and resolving', () => {
  it('deleting the active profile falls back to its base\'s built-in', () => {
    let s = duplicateProfile(DEFAULT_APPEARANCE, 'builtin:solarized', 'a');
    s = deleteProfile(s, 'a');
    expect(s).toEqual({ activeProfileId: 'builtin:solarized', profiles: [] });
  });

  it('deleting a profile that is not active leaves the active one', () => {
    let s = duplicateProfile(DEFAULT_APPEARANCE, 'builtin:nord', 'a');
    s = setActiveProfile(s, 'builtin:light');
    s = deleteProfile(s, 'a');
    expect(s.activeProfileId).toBe('builtin:light');
  });

  it('an active id that names nothing resolves to Dark; setActiveProfile ignores an unknown id', () => {
    const s: AppearanceState = { activeProfileId: 'gone', profiles: [] };
    expect(resolveActiveProfile(s).id).toBe('builtin:dark');
    expect(setActiveProfile(DEFAULT_APPEARANCE, 'gone')).toBe(DEFAULT_APPEARANCE);
  });
});

describe('decision 5 / A4 — export and import', () => {
  const custom = () => {
    let s = duplicateProfile(DEFAULT_APPEARANCE, 'builtin:light', 'a');
    s = updateProfile(s, 'a', { name: 'Sepia' });
    // Set out of registry order on purpose: the export writes registry order.
    s = setOverride(s, 'a', '--editor-h1', '#3b2a1a');
    s = setOverride(s, 'a', '--editor-canvas-bg', '#efe6d6');
    s = setOverride(s, 'a', '--editor-page-shadow', 'none');
    return s;
  };

  it('the export is the fixed shape: format, version, name, base, syntaxTheme, overrides in registry order', () => {
    const text = exportProfile(resolveActiveProfile(custom()));
    expect(text).toBe([
      '{',
      '  "format": "dita-architect-appearance",',
      '  "version": 1,',
      '  "name": "Sepia",',
      '  "base": "light",',
      '  "syntaxTheme": "daylight",',
      '  "overrides": {',
      '    "--editor-canvas-bg": "#efe6d6",',
      '    "--editor-page-shadow": "none",',
      '    "--editor-h1": "#3b2a1a"',
      '  }',
      '}',
      '',
    ].join('\n'));
  });

  it('export → import → export is byte-identical, and the import becomes the active profile', () => {
    const s = custom();
    const text = exportProfile(resolveActiveProfile(s));
    const res = importProfile(DEFAULT_APPEARANCE, text, 'imp');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.activeProfileId).toBe('imp');
    expect(exportProfile(resolveActiveProfile(res.state))).toBe(text);
  });

  it('a built-in exports too (the way to start an outside edit)', () => {
    expect(JSON.parse(exportProfile(BUILT_IN_PROFILES[3]))).toEqual({ format: 'dita-architect-appearance', version: 1, name: 'Nord', base: 'nord', syntaxTheme: 'material', overrides: {} });
  });

  it('an imported name that is taken gets a number', () => {
    const s = custom();
    const res = importProfile(s, exportProfile(resolveActiveProfile(s)), 'imp');
    expect(res.ok && resolveActiveProfile(res.state).name).toBe('Sepia 2');
  });

  const doc = (over: Record<string, unknown>) => JSON.stringify({ format: 'dita-architect-appearance', version: 1, name: 'Altitude', base: 'light', syntaxTheme: 'daylight', overrides: {}, ...over });
  const refused = (text: string) => {
    const res = importProfile(DEFAULT_APPEARANCE, text, 'x');
    expect(res.ok).toBe(false);
    return res.ok ? [] : res.errors;
  };

  it('an override naming a variable this version does not have is refused, by name, with nothing imported', () => {
    const errors = refused(doc({ overrides: { '--editor-accent': '#ff0000', '--app-accent-red': '#db0000', '--brand-x': '#000000' } }));
    expect(errors.join(' ')).toContain('--app-accent-red');
    expect(errors.join(' ')).toContain('--brand-x');
    expect(errors.join(' ')).not.toContain('--editor-accent');
  });

  it.each([
    ['not JSON', '{ nope', /not JSON/],
    ['an array', '[]', /not a DITA Architect appearance profile/],
    ['the wrong format', doc({ format: 'vscode-theme' }), /not a DITA Architect appearance profile/],
    ['a future version', doc({ version: 2 }), /version is 2; this app reads version 1/],
    ['an unknown base', doc({ base: 'altitude' }), /base "altitude"/],
    ['an unknown syntax theme', doc({ syntaxTheme: 'solarized-dark' }), /syntax theme "solarized-dark"/],
    ['a value that fails the check', doc({ overrides: { '--app-bg': 'url(https://example.com/a.png)' } }), /--app-bg/],
    ['overrides that are not an object', doc({ overrides: ['#fff'] }), /overrides/],
    ['a name that is not text', doc({ name: 7 }), /name/],
  ])('%s is refused with the reason', (_label, text, reason) => {
    expect(refused(text).join(' ')).toMatch(reason);
  });

  it('every problem is reported at once, not only the first', () => {
    expect(refused(doc({ base: 'x', syntaxTheme: 'y', overrides: { '--nope': '#fff' } })).length).toBe(3);
  });
});

describe('decision 4 — the value check', () => {
  it.each([
    ['--app-bg', '#fff', true], ['--app-bg', '#1e1e1e', true], ['--app-bg', '#1e1e1e80', true],
    ['--app-bg', 'rgba(56, 189, 248, 0.10)', true], ['--app-bg', 'rgb(0,0,0)', true], ['--app-bg', 'hsl(200, 50%, 40%)', true],
    ['--app-bg', 'transparent', true],
    ['--app-bg', '', false], ['--app-bg', 'red', false], ['--app-bg', '#12', false], ['--app-bg', 'url(x)', false],
    ['--app-bg', 'expression(alert(1))', false], ['--app-bg', '#fff;color:red', false], ['--app-bg', 'rgba(0,0,0,0.5)}', false],
    ['--editor-page-shadow', 'none', true], ['--editor-page-shadow', '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)', true],
    ['--editor-page-shadow', 'url(x) 0 0', false], ['--editor-page-shadow', '0 0 1px <b>', false],
    ['--editor-page-border', '1px solid var(--app-border)', true], ['--editor-page-border', 'none', true],
    ['--editor-page-border', '1px solid \\61 ', false],
  ])('%s: %s → %s', (name, value, expected) => {
    expect(isValidValue(name as never, value)).toBe(expected);
  });

  it('parseColour reads hex and rgb(a) into a picker hex plus the alpha to keep; withAlpha writes it back', () => {
    expect(parseColour('#abc')).toEqual({ hex: '#aabbcc', alpha: null });
    expect(parseColour('#1E1E1E')).toEqual({ hex: '#1e1e1e', alpha: null });
    expect(parseColour('rgba(56, 189, 248, 0.10)')).toEqual({ hex: '#38bdf8', alpha: '0.10' });
    expect(parseColour('rgb(0, 0, 0)')).toEqual({ hex: '#000000', alpha: null });
    expect(parseColour('hsl(1,2%,3%)')).toBeNull();
    expect(withAlpha('#38bdf8', '0.10')).toBe('rgba(56, 189, 248, 0.10)');
    expect(withAlpha('#38bdf8', null)).toBe('#38bdf8');
  });
});

describe('A2 (pure half) — a stored theme pair becomes a profile', () => {
  const themes = THEME_OPTIONS.map(o => o.value);
  const syntaxes = SYNTAX_THEME_OPTIONS.map(o => o.value);

  it.each(themes.flatMap(t => syntaxes.map(x => [t, x] as const)))('%s + %s lands on the matching built-in or on a custom profile of exactly that pair', (theme, syntax) => {
    const s = migrateThemePair(theme, syntax);
    const p = resolveActiveProfile(s);
    expect([p.base, p.syntaxTheme]).toEqual([theme, syntax]);
    expect(p.overrides).toEqual({});
    const builtIn = BUILT_IN_PROFILES.find(b => b.base === theme && b.syntaxTheme === syntax);
    if (builtIn) {
      expect(s).toEqual({ activeProfileId: builtIn.id, profiles: [] });
    } else {
      expect(s.profiles.length).toBe(1);
      expect(p.builtIn).toBe(false);
      const themeLabel = THEME_OPTIONS.find(o => o.value === theme)!.label;
      const synLabel = SYNTAX_THEME_OPTIONS.find(o => o.value === syntax)!.label;
      expect(p.name).toBe(`${themeLabel}, ${synLabel} XML`);
    }
  });

  it('exactly six of the 42 pairs are built-ins; 36 make a custom profile', () => {
    const pairs = themes.flatMap(t => syntaxes.map(x => migrateThemePair(t, x)));
    expect(pairs.filter(s => s.profiles.length === 0).length).toBe(6);
    expect(pairs.filter(s => s.profiles.length === 1).length).toBe(36);
  });

  it('a stored "geotab" lands on Navy (FR-061 kept); garbage or nothing lands on Dark/Material', () => {
    expect(migrateThemePair('geotab', 'material')).toEqual({ activeProfileId: 'builtin:navy', profiles: [] });
    expect(migrateThemePair(null, null)).toEqual(DEFAULT_APPEARANCE);
    expect(migrateThemePair('altitude', 'nope')).toEqual(DEFAULT_APPEARANCE);
    expect(resolveStoredTheme('GEOTAB')).toBe('dark');
  });

  it('a theme with no stored syntax theme takes that theme\'s built-in pairing', () => {
    expect(migrateThemePair('light', null)).toEqual({ activeProfileId: 'builtin:light', profiles: [] });
    expect(migrateThemePair('claude', null)).toEqual({ activeProfileId: builtInId('claude'), profiles: [] });
  });
});

describe('parseStoredAppearance — tolerant of whatever is in the store', () => {
  it('keeps good profiles, drops broken ones and unknown or invalid overrides, never throws', () => {
    const s = parseStoredAppearance({
      activeProfileId: 'p1',
      profiles: [
        { id: 'p1', name: 'Good', base: 'nord', syntaxTheme: 'dracula', overrides: { '--app-bg': '#000000', '--gone': '#fff', '--app-hover': 'url(x)' } },
        { id: 'p2', name: 'Bad base', base: 'altitude', syntaxTheme: 'material', overrides: {} },
        { id: 'builtin:dark', name: 'Impostor', base: 'dark', syntaxTheme: 'material', overrides: {} },
        { id: 'p1', name: 'Duplicate id', base: 'dark', syntaxTheme: 'material', overrides: {} },
        'nonsense',
      ],
    });
    expect(s.profiles.map(p => [p.id, p.name, p.overrides])).toEqual([['p1', 'Good', { '--app-bg': '#000000' }]]);
    expect(s.activeProfileId).toBe('p1');
    for (const bad of [null, 'x', 3, [], { profiles: 'x' }]) expect(parseStoredAppearance(bad)).toEqual(DEFAULT_APPEARANCE);
  });

  it('all 63 variables can be overridden at once and survive the store', () => {
    let s = duplicateProfile(DEFAULT_APPEARANCE, 'builtin:dark', 'a');
    for (const v of APPEARANCE_VAR_NAMES) s = setOverride(s, 'a', v, v === '--editor-page-shadow' ? '0 0 1px #010203' : v === '--editor-page-border' ? '1px solid #010203' : '#010203');
    const back = parseStoredAppearance(JSON.parse(JSON.stringify(s)));
    expect(Object.keys(resolveActiveProfile(back).overrides).length).toBe(63);
  });
});
