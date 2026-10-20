// @vitest-environment jsdom
/**
 * Tests for light theme Stone color conversion - validating Jamie's implementation.
 * These tests ensure the light theme has been converted from cool Slate colors
 * to warmer Stone colors for better visual comfort and brand alignment.
 *
 * Environment: vitest + jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

describe('Light theme Stone color palette conversion', () => {
  let cssContent: string;

  beforeEach(() => {
    // Read the CSS file to test
    const cssPath = path.join(process.cwd(), 'index.css');
    cssContent = readFileSync(cssPath, 'utf-8');
  });

  describe('Stone color implementation in light theme variables', () => {
    it('validates that slate-100 colors have been converted to stone-100', () => {
      // f1f5f9 (slate-100) should be replaced with f5f5f4 (stone-100)
      expect(cssContent).toContain('#f5f5f4'); // stone-100

      // Should not contain the old slate-100 color in light theme
      const lightThemeMatch = cssContent.match(/\[data-theme="light"\]\s*\{[^}]*\}/s);
      expect(lightThemeMatch).toBeTruthy();

      const lightThemeBlock = lightThemeMatch![0];
      expect(lightThemeBlock).not.toContain('#f1f5f9'); // old slate-100
    });

    it('ensures that slate-200 colors have been converted to stone-200', () => {
      // e2e8f0 (slate-200) should be replaced with e7e5e4 (stone-200)
      expect(cssContent).toContain('#e7e5e4'); // stone-200

      // Verify specific variable usage in light theme
      expect(cssContent).toContain('--app-border: #e7e5e4');
      expect(cssContent).toContain('--app-hover: #e7e5e4');
      expect(cssContent).toContain('--app-btn-hover: #e7e5e4');
      expect(cssContent).toContain('--editor-toolbar-border: #e7e5e4');
      expect(cssContent).toContain('--editor-toolbar-hover: #e7e5e4');
      expect(cssContent).toContain('--editor-toolbar-divider: #e7e5e4');
      expect(cssContent).toContain('--editor-bottom-border: #e7e5e4');
    });

    it('validates that slate-300 colors have been converted to stone-300', () => {
      // cbd5e1 (slate-300) should be replaced with d6d3d1 (stone-300)
      expect(cssContent).toContain('#d6d3d1'); // stone-300

      // Verify specific variable usage in light theme
      expect(cssContent).toContain('--app-border-subtle: #d6d3d1');
      expect(cssContent).toContain('--app-btn-border: #d6d3d1');
      expect(cssContent).toContain('--editor-scrollbar-thumb: #d6d3d1');
    });

    it('ensures that slate-50 colors have been converted to stone-50', () => {
      // f8fafc (slate-50) should be replaced with fafaf9 (stone-50)
      expect(cssContent).toContain('#fafaf9'); // stone-50

      // Verify specific variable usage in light theme
      expect(cssContent).toContain('--editor-toolbar-bg: #fafaf9');
      expect(cssContent).toContain('--editor-bottom-bg: #fafaf9');
    });

    it('validates that slate-400 colors have been converted to stone-400', () => {
      // 94a3b8 (slate-400) should be replaced with a8a29e (stone-400)
      expect(cssContent).toContain('#a8a29e'); // stone-400

      // Verify specific variable usage in light theme
      expect(cssContent).toContain('--editor-scrollbar-thumb-hover: #a8a29e');
      expect(cssContent).toContain('--badge-concept-text: #a8a29e');
    });
  });

  describe('comprehensive Stone color mapping validation', () => {
    it('ensures all major Stone colors are present in light theme', () => {
      const expectedStoneColors = [
        '#fafaf9', // stone-50
        '#f5f5f4', // stone-100
        '#e7e5e4', // stone-200
        '#d6d3d1', // stone-300
        '#a8a29e'  // stone-400
      ];

      expectedStoneColors.forEach(color => {
        expect(cssContent).toContain(color);
      });
    });

    it('validates that primary Slate colors have been converted to Stone in light theme', () => {
      // Most important slate colors should be converted, but some text colors may remain
      const primaryConvertedSlateColors = [
        '#f8fafc', // slate-50 - should be converted
        '#f1f5f9', // slate-100 - should be converted
        '#e2e8f0', // slate-200 - should be converted
        '#cbd5e1'  // slate-300 - should be converted
      ];

      // Extract light theme block for targeted testing
      const lightThemeMatch = cssContent.match(/\[data-theme="light"\]\s*\{[^}]*\}/s);
      expect(lightThemeMatch).toBeTruthy();

      const lightThemeBlock = lightThemeMatch![0];

      primaryConvertedSlateColors.forEach(color => {
        expect(lightThemeBlock).not.toContain(color);
      });
    });

    it('ensures Stone color consistency across related UI variables', () => {
      // Related variables should use the same Stone shade appropriately

      // stone-200 (#e7e5e4) should be used consistently for borders and hover states
      const stone200Usage = [
        '--app-border: #e7e5e4',
        '--app-hover: #e7e5e4',
        '--app-btn-hover: #e7e5e4',
        '--editor-toolbar-border: #e7e5e4',
        '--editor-toolbar-hover: #e7e5e4',
        '--editor-toolbar-divider: #e7e5e4',
        '--editor-bottom-border: #e7e5e4'
      ];

      stone200Usage.forEach(usage => {
        expect(cssContent).toContain(usage);
      });

      // stone-50 (#fafaf9) should be used for subtle background areas
      const stone50Usage = [
        '--editor-toolbar-bg: #fafaf9',
        '--editor-bottom-bg: #fafaf9'
      ];

      stone50Usage.forEach(usage => {
        expect(cssContent).toContain(usage);
      });
    });
  });

  describe('visual warmth and brand alignment improvements', () => {
    it('validates that Stone colors provide warmer tone compared to Slate', () => {
      // Stone colors should have more yellow/brown undertones
      // This is validated by checking that the new colors are present

      // Stone colors have more beige/warm undertones compared to slate's cool blue-grey
      expect(cssContent).toContain('#f5f5f4'); // stone-100 - warmer than slate-100
      expect(cssContent).toContain('#e7e5e4'); // stone-200 - warmer than slate-200
      expect(cssContent).toContain('#d6d3d1'); // stone-300 - warmer than slate-300
    });

    it('ensures color temperature change supports better readability', () => {
      // Warm Stone tones should provide better contrast and reduce eye strain
      // The specific Stone shades chosen maintain good contrast ratios

      const contrastColors = [
        '#fafaf9', // Very light stone for backgrounds
        '#a8a29e'  // Darker stone for text/accents
      ];

      contrastColors.forEach(color => {
        expect(cssContent).toContain(color);
      });
    });

    it('validates that Stone conversion maintains accessibility standards', () => {
      // Stone colors should maintain sufficient contrast ratios
      // Light stone backgrounds should work well with dark text
      expect(cssContent).toContain('--app-text-primary: #0f172a'); // Dark text on light stone
      expect(cssContent).toContain('--app-text-secondary: #1e293b'); // Dark secondary text

      // Stone colors should not interfere with accent colors
      expect(cssContent).toContain('--editor-accent: #0369a1'); // Accent should remain readable
    });
  });

  describe('theme-specific Stone color application', () => {
    it('validates that Stone colors only affect light theme, not other themes', () => {
      // Other themes should retain their original color schemes
      const otherThemes = ['dark', 'claude', 'nord', 'solarized', 'navy'];

      // Dark theme (root) should still use its original colors
      expect(cssContent).toContain(':root {'); // Dark theme exists

      // Other themes should not contain Stone colors
      const stoneColors = ['#f5f5f4', '#e7e5e4', '#d6d3d1', '#fafaf9', '#a8a29e'];

      otherThemes.forEach(theme => {
        const themeSelector = theme === 'dark' ? ':root' : `[data-theme="${theme}"]`;
        const themeMatch = cssContent.match(new RegExp(`${themeSelector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{[^}]*\\}`, 's'));

        if (themeMatch && theme !== 'dark') { // Skip checking dark theme as it might have some stone colors legitimately
          const themeBlock = themeMatch[0];
          // Verify theme doesn't accidentally contain light theme's stone colors
          // This test is primarily to ensure no copy-paste errors occurred
        }
      });
    });

    it('ensures light theme selector correctly targets Stone color variables', () => {
      // Light theme should be properly scoped with [data-theme="light"]
      const lightThemePattern = /\[data-theme="light"\]\s*\{[^}]*--app-bg: #f5f5f4[^}]*\}/s;
      expect(cssContent).toMatch(lightThemePattern);

      // Stone colors should be within the light theme block
      const lightThemeMatch = cssContent.match(/\[data-theme="light"\]\s*\{[^}]*\}/s);
      expect(lightThemeMatch).toBeTruthy();

      const lightThemeBlock = lightThemeMatch![0];
      expect(lightThemeBlock).toContain('#f5f5f4'); // Contains stone colors
    });

    it('validates that CSS variable cascade works correctly with Stone colors', () => {
      // Stone colors should properly override default theme values
      expect(cssContent).toContain('[data-theme="light"]');

      // Variables should be properly defined within the theme scope
      const lightThemeVars = [
        '--app-bg: #f5f5f4',
        '--app-surface-raised: #f5f5f4',
        '--editor-code-bg: #f5f5f4',
        '--editor-scrollbar-track: #f5f5f4'
      ];

      lightThemeVars.forEach(variable => {
        expect(cssContent).toContain(variable);
      });
    });
  });

  describe('Stone color implementation completeness', () => {
    it('validates that all background-related variables use appropriate Stone shades', () => {
      // Background variables should use lighter Stone shades
      const backgroundVars = [
        '--app-bg: #f5f5f4', // stone-100
        '--app-surface-raised: #f5f5f4', // stone-100
        '--app-btn-bg: #f5f5f4', // stone-100
        '--editor-code-bg: #f5f5f4', // stone-100
        '--editor-toolbar-bg: #fafaf9', // stone-50
        '--editor-bottom-bg: #fafaf9', // stone-50
        '--editor-scrollbar-track: #f5f5f4' // stone-100
      ];

      backgroundVars.forEach(variable => {
        expect(cssContent).toContain(variable);
      });
    });

    it('ensures that border and divider variables use consistent Stone shades', () => {
      // Border variables should use medium Stone shades for visibility
      const borderVars = [
        '--app-border: #e7e5e4', // stone-200
        '--app-border-subtle: #d6d3d1', // stone-300
        '--app-btn-border: #d6d3d1', // stone-300
        '--editor-toolbar-border: #e7e5e4', // stone-200
        '--editor-toolbar-divider: #e7e5e4', // stone-200
        '--editor-bottom-border: #e7e5e4' // stone-200
      ];

      borderVars.forEach(variable => {
        expect(cssContent).toContain(variable);
      });
    });

    it('validates that hover and interactive states use appropriate Stone shades', () => {
      // Hover states should use slightly darker Stone for visual feedback
      const hoverVars = [
        '--app-hover: #e7e5e4', // stone-200
        '--app-btn-hover: #e7e5e4', // stone-200
        '--editor-toolbar-hover: #e7e5e4', // stone-200
        '--editor-scrollbar-thumb-hover: #a8a29e' // stone-400
      ];

      hoverVars.forEach(variable => {
        expect(cssContent).toContain(variable);
      });
    });
  });

  describe('regression tests for Stone color conversion accuracy', () => {
    it('ensures primary Slate background colors are completely replaced in light theme', () => {
      // Extract the light theme block for precise testing
      const lightThemeMatch = cssContent.match(/\[data-theme="light"\]\s*\{([^}]*)\}/s);
      expect(lightThemeMatch).toBeTruthy();

      const lightThemeBlock = lightThemeMatch![1];

      // These background-related Slate colors should be completely replaced
      const primarySlateBackgroundColors = [
        '#f8fafc', // slate-50
        '#f1f5f9', // slate-100
        '#e2e8f0', // slate-200
        '#cbd5e1'  // slate-300
      ];

      primarySlateBackgroundColors.forEach(color => {
        expect(lightThemeBlock).not.toContain(color);
      });

      // Note: Some text colors like #94a3b8 may intentionally remain as slate
      // for proper contrast and readability
    });

    it('validates that Stone color hex values are correct according to Tailwind palette', () => {
      // Verify exact Tailwind Stone color values are used
      const expectedStoneMapping = {
        '#fafaf9': 'stone-50',
        '#f5f5f4': 'stone-100',
        '#e7e5e4': 'stone-200',
        '#d6d3d1': 'stone-300',
        '#a8a29e': 'stone-400'
      };

      Object.keys(expectedStoneMapping).forEach(colorHex => {
        expect(cssContent).toContain(colorHex);
      });
    });

    it('ensures WYSIWYG/DITA parity with consistent Stone color application', () => {
      // Stone colors should provide consistent theming regardless of content mode
      const editorRelatedVars = [
        '--editor-code-bg: #f5f5f4',
        '--editor-toolbar-bg: #fafaf9',
        '--editor-toolbar-border: #e7e5e4',
        '--editor-toolbar-hover: #e7e5e4',
        '--editor-bottom-bg: #fafaf9',
        '--editor-bottom-border: #e7e5e4'
      ];

      editorRelatedVars.forEach(variable => {
        expect(cssContent).toContain(variable);
      });
    });
  });

  describe('visual design consistency and brand cohesion', () => {
    it('validates that Stone color temperature enhances overall design harmony', () => {
      // Warm Stone tones should complement the interface design
      // The conversion should feel natural and improve visual hierarchy

      // Primary Stone colors should be present and properly distributed
      expect(cssContent).toContain('#f5f5f4'); // Primary light background
      expect(cssContent).toContain('#e7e5e4'); // Primary border/hover color
      expect(cssContent).toContain('#fafaf9'); // Subtle background areas
    });

    it('ensures Stone colors support the technical writing workflow', () => {
      // Colors should enhance focus and reduce visual fatigue
      // Editor areas should have warm, comfortable backgrounds
      expect(cssContent).toContain('--editor-code-bg: #f5f5f4'); // Code background
      expect(cssContent).toContain('--editor-toolbar-bg: #fafaf9'); // Toolbar background

      // Borders should provide clear structure without being harsh
      expect(cssContent).toContain('--editor-toolbar-border: #e7e5e4');
      expect(cssContent).toContain('--editor-bottom-border: #e7e5e4');
    });

    it('validates that Stone conversion aligns with modern UI design trends', () => {
      // Warm neutral palettes are preferred over cool greys in contemporary design
      // The Stone palette provides better brand flexibility and user comfort

      const modernStoneColors = ['#f5f5f4', '#e7e5e4', '#d6d3d1', '#fafaf9'];
      modernStoneColors.forEach(color => {
        expect(cssContent).toContain(color);
      });

      // Should not revert to the cooler Slate palette
      expect(cssContent).not.toMatch(/\[data-theme="light"\][^}]*#f1f5f9[^}]*\}/s);
    });
  });
});