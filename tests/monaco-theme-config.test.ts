import { describe, it, expect } from 'vitest';

// The XML split's per-theme background table. This suite used to test a copy of
// the table pasted in from MonacoDitaEditor.tsx; since ADR-018 the table lives in
// lib/monaco-themes.ts (shared with the Appearance drawer's preview) and is tested
// here directly. A6 at the end: Monaco's theme follows the active profile.
import { MONACO_BG as bgColors, SYNTAX_RULES, buildThemeName, monacoThemeData } from '../lib/monaco-themes';
import { BUILT_IN_PROFILES, SYNTAX_THEME_OPTIONS, THEME_OPTIONS, duplicateProfile, updateProfile, resolveActiveProfile, DEFAULT_APPEARANCE } from '../lib/appearance';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Monaco editor theme configuration — bgColors object', () => {
  it('includes configurations for all six supported themes', () => {
    const themeNames = Object.keys(bgColors);
    expect(themeNames).toHaveLength(6);
    expect(themeNames).toEqual(['dark', 'light', 'claude', 'nord', 'solarized', 'navy']);
  });

  it('provides complete color configuration for each theme', () => {
    Object.values(bgColors).forEach(config => {
      expect(config).toHaveProperty('bg');
      expect(config).toHaveProperty('lineHighlight');
      expect(config).toHaveProperty('lineNumber');
      expect(typeof config.bg).toBe('string');
      expect(typeof config.lineHighlight).toBe('string');
      expect(typeof config.lineNumber).toBe('string');
    });
  });

  describe('Navy theme configuration', () => {
    it('includes navy theme in the bgColors object', () => {
      expect(bgColors).toHaveProperty('navy');
    });

    it('uses appropriate dark background derived from Geotab brand colors', () => {
      expect(bgColors.navy.bg).toBe('#1e2332');
    });

    it('uses Geotab Blue for line highlight to provide visual feedback', () => {
      expect(bgColors.navy.lineHighlight).toBe('#25477b');
    });

    it('uses muted color for line numbers to avoid distraction', () => {
      expect(bgColors.navy.lineNumber).toBe('#8a9ba8');
    });

    it('provides complete configuration object with all required properties', () => {
      const navyConfig = bgColors.navy;
      expect(navyConfig).toEqual({
        bg: '#1e2332',
        lineHighlight: '#25477b',
        lineNumber: '#8a9ba8'
      });
    });
  });

  describe('color format validation — hex colors for Monaco editor', () => {
    const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

    it('all background colors are valid 6-digit hex codes', () => {
      Object.values(bgColors).forEach(config => {
        expect(config.bg).toMatch(hexColorRegex);
      });
    });

    it('all lineHighlight colors are valid 6-digit hex codes', () => {
      Object.values(bgColors).forEach(config => {
        expect(config.lineHighlight).toMatch(hexColorRegex);
      });
    });

    it('all lineNumber colors are valid 6-digit hex codes', () => {
      Object.values(bgColors).forEach(config => {
        expect(config.lineNumber).toMatch(hexColorRegex);
      });
    });
  });

  describe('theme consistency — color relationships', () => {
    it('navy theme uses darker background than line highlight for proper contrast', () => {
      const bg = bgColors.navy.bg;        // #1e2332
      const highlight = bgColors.navy.lineHighlight;  // #25477b

      // Convert to numeric values for comparison (crude but effective for these specific colors)
      const bgValue = parseInt(bg.slice(1), 16);
      const highlightValue = parseInt(highlight.slice(1), 16);

      expect(bgValue).toBeLessThan(highlightValue);
    });

    it('all themes have distinct background colors for theme recognition', () => {
      const backgrounds = Object.values(bgColors).map(config => config.bg);
      const uniqueBackgrounds = new Set(backgrounds);

      expect(uniqueBackgrounds.size).toBe(backgrounds.length);
    });

    it('navy colors align with brand identity — darker professional appearance', () => {
      const { bg, lineHighlight } = bgColors.navy;

      // These specific colors should match the Geotab brand-derived colors from Anna's plan
      expect(bg).toBe('#1e2332');           // Dark background derived from brand colors
      expect(lineHighlight).toBe('#25477b'); // Geotab Blue from brand palette
    });
  });

  describe('TypeScript type safety — Record structure', () => {
    it('bgColors object has expected Record type structure', () => {
      // This test documents the type constraint — each theme must have bg/lineHighlight/lineNumber
      type ExpectedStructure = Record<string, { bg: string; lineHighlight: string; lineNumber: string }>;

      // TypeScript compilation enforces this, but we test the runtime structure
      Object.entries(bgColors).forEach(([themeName, config]) => {
        expect(typeof themeName).toBe('string');
        expect(typeof config.bg).toBe('string');
        expect(typeof config.lineHighlight).toBe('string');
        expect(typeof config.lineNumber).toBe('string');
      });
    });
  });
});

describe('A6 — Monaco\'s theme follows the appearance profile', () => {
  it('every syntax theme has token rules, and every app theme a background set', () => {
    expect(Object.keys(SYNTAX_RULES)).toEqual(SYNTAX_THEME_OPTIONS.map(o => o.value));
    expect(Object.keys(bgColors)).toEqual(THEME_OPTIONS.map(o => o.value));
  });

  it.each(BUILT_IN_PROFILES.map(p => [p.name, p] as const))('the %s built-in defines a Monaco theme from its base and syntax theme', (_n, p) => {
    expect(buildThemeName(p.base, p.syntaxTheme)).toBe(`combo-${p.base}-${p.syntaxTheme}`);
    const t = monacoThemeData(p.base, p.syntaxTheme);
    expect(t.colors['editor.background']).toBe(bgColors[p.base].bg);
    expect(t.rules).toBe(SYNTAX_RULES[p.syntaxTheme].rules);
    expect(t.base).toBe(p.base === 'light' ? 'vs' : SYNTAX_RULES[p.syntaxTheme].base);
  });

  it('a custom profile\'s syntax theme is the Monaco theme (Nord with Dracula is combo-nord-dracula)', () => {
    let s = duplicateProfile(DEFAULT_APPEARANCE, 'builtin:nord', 'p');
    s = updateProfile(s, 'p', { syntaxTheme: 'dracula' });
    const p = resolveActiveProfile(s);
    expect(buildThemeName(p.base, p.syntaxTheme)).toBe('combo-nord-dracula');
  });

  it('the editor redefines and sets its theme whenever the base or the syntax theme changes, and the split passes the profile\'s pair', () => {
    const editor = readFileSync(join(__dirname, '..', 'components', 'MonacoDitaEditor.tsx'), 'utf-8');
    expect(editor).toMatch(/defineComboTheme\(monacoRef\.current, editorTheme, syntaxTheme\);\s*monacoRef\.current\.editor\.setTheme\(buildThemeName\(editorTheme, syntaxTheme\)\);\s*\}\s*\}, \[editorTheme, syntaxTheme\]\);/);
    const split = readFileSync(join(__dirname, '..', 'components', 'workbench', 'XmlSplit.tsx'), 'utf-8');
    expect(split).toMatch(/editorTheme=\{appTheme\}\s*syntaxTheme=\{syntaxTheme\}/);
    const app = readFileSync(join(__dirname, '..', 'dita-architect.tsx'), 'utf-8');
    expect(app).toMatch(/const appTheme = appearance\.active\.base;\s*const syntaxTheme = appearance\.active\.syntaxTheme;/);
  });
});
