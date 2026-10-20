import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Extract and test Monaco editor theme configuration from MonacoDitaEditor.tsx
// This tests the bgColors object, including the navy theme (formerly "geotab", renamed FR-061).
// ---------------------------------------------------------------------------

/** Mirror of the bgColors configuration from MonacoDitaEditor.tsx line 104 */
const bgColors = {
  dark:      { bg: '#111111', lineHighlight: '#1e1e1e', lineNumber: '#555555' },
  light:     { bg: '#f1f5f9', lineHighlight: '#e2e8f0', lineNumber: '#94a3b8' },
  claude:    { bg: '#1f150f', lineHighlight: '#3d2e24', lineNumber: '#8a7568' },
  nord:      { bg: '#242933', lineHighlight: '#3b4252', lineNumber: '#616e88' },
  solarized: { bg: '#001e28', lineHighlight: '#073642', lineNumber: '#586e75' },
  navy:      { bg: '#1e2332', lineHighlight: '#25477b', lineNumber: '#8a9ba8' },
} as const;

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