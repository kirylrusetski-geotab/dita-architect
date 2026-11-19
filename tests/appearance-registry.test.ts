// ADR-018 decision 2 / A1 — the variable registry is the contract between
// index.css and the profile model. It must equal the :root block and every
// [data-theme] block exactly: a variable added to the CSS and not the registry
// (or the reverse) fails here. At v1.2.0 every block defined exactly 63; pinned.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { APPEARANCE_VARS, APPEARANCE_VAR_NAMES, APPEARANCE_GROUPS, isAppearanceVar } from '../constants/appearance-vars';
import { THEME_OPTIONS, THEME_VALUES, parseThemeBlocks, isValidValue } from '../lib/appearance';

const CSS = readFileSync(join(__dirname, '..', 'index.css'), 'utf-8');

/** The test's own reading of the CSS, independent of lib/appearance's parser. */
function blocks(css: string): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  for (const m of css.matchAll(/(:root(?:,\s*\[data-theme="dark"\])?|\[data-theme="(\w+)"\])\s*\{([^}]*)\}/g)) {
    const name = m[2] ?? 'dark';
    const vars = new Map<string, string>();
    for (const d of m[3].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars.set(d[1], d[2].trim());
    out.set(name, vars);
  }
  return out;
}

const parsed = blocks(CSS);

describe('A1 — the registry equals index.css', () => {
  it('there are exactly six theme blocks, one per theme option', () => {
    expect([...parsed.keys()].sort()).toEqual(THEME_OPTIONS.map(o => o.value).sort());
  });

  it('the registry has 63 unique names, each with a label, a known group and a kind', () => {
    expect(APPEARANCE_VARS.length).toBe(63);
    expect(new Set(APPEARANCE_VAR_NAMES).size).toBe(63);
    for (const v of APPEARANCE_VARS) {
      expect(v.label.length).toBeGreaterThan(0);
      expect(APPEARANCE_GROUPS as readonly string[]).toContain(v.group);
      expect(['color', 'shadow', 'border']).toContain(v.kind);
    }
  });

  it.each([...parsed.keys()])('the %s block defines exactly the registry, no more and no fewer', (theme) => {
    const names = [...parsed.get(theme)!.keys()];
    expect(names.length).toBe(63);
    expect(new Set(names)).toEqual(new Set(APPEARANCE_VAR_NAMES));
  });

  it('every group has at least one variable and the groups list is in registry order', () => {
    const seen: string[] = [];
    for (const v of APPEARANCE_VARS) if (!seen.includes(v.group)) seen.push(v.group);
    expect(seen).toEqual([...APPEARANCE_GROUPS]);
  });

  it('only the page shadow and the page border are not colours', () => {
    expect(APPEARANCE_VARS.filter(v => v.kind !== 'color').map(v => [v.name, v.kind])).toEqual([
      ['--editor-page-shadow', 'shadow'],
      ['--editor-page-border', 'border'],
    ]);
  });

  it('isAppearanceVar accepts registry names only', () => {
    expect(isAppearanceVar('--app-bg')).toBe(true);
    expect(isAppearanceVar('--app-accent-red')).toBe(false);
    expect(isAppearanceVar('app-bg')).toBe(false);
    expect(isAppearanceVar(42)).toBe(false);
  });
});

describe('the base values the app reads at run time are the CSS, not a copy', () => {
  it('THEME_VALUES (parsed from index.css?raw) equals this test\'s reading of the file, value for value', () => {
    for (const [theme, vars] of parsed) {
      expect(THEME_VALUES[theme as keyof typeof THEME_VALUES]).toEqual(Object.fromEntries(vars));
    }
  });

  it('parseThemeBlocks reads the same blocks from the same text', () => {
    expect(parseThemeBlocks(CSS)).toEqual(THEME_VALUES);
  });

  it('every value in every theme passes the value check for its kind (the check never refuses the app\'s own colours)', () => {
    for (const [theme, vars] of parsed) {
      for (const [name, value] of vars) {
        expect(isValidValue(name as never, value), `${theme} ${name}: ${value}`).toBe(true);
      }
    }
  });
});
