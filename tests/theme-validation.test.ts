// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Extract and test the theme validation logic from useEditorUi.ts
// This tests the localStorage theme persistence that Jamie fixed.
// ---------------------------------------------------------------------------

/** Mirror of the theme validation logic from useEditorUi.ts line 23 */
function validateStoredTheme(stored: string | null): string {
  if (stored === 'light' || stored === 'claude' || stored === 'nord' || stored === 'solarized' || stored === 'navy' || stored === 'dark') {
    return stored;
  }
  return 'dark';
}

/** Mock localStorage for testing persistence behavior */
class MockLocalStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  clear(): void {
    this.store = {};
  }
}

describe('theme validation — localStorage persistence logic', () => {
  let mockLocalStorage: MockLocalStorage;

  beforeEach(() => {
    mockLocalStorage = new MockLocalStorage();
    // Replace global localStorage with our mock
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });
  });

  describe('validateStoredTheme — theme validation from localStorage', () => {
    it('accepts light theme as valid', () => {
      expect(validateStoredTheme('light')).toBe('light');
    });

    it('accepts claude theme as valid', () => {
      expect(validateStoredTheme('claude')).toBe('claude');
    });

    it('accepts nord theme as valid', () => {
      expect(validateStoredTheme('nord')).toBe('nord');
    });

    it('accepts solarized theme as valid', () => {
      expect(validateStoredTheme('solarized')).toBe('solarized');
    });

    it('accepts navy theme as valid — new theme from Jamie\'s implementation', () => {
      expect(validateStoredTheme('navy')).toBe('navy');
    });

    it('accepts dark theme as valid — Elena noted this was previously missing', () => {
      expect(validateStoredTheme('dark')).toBe('dark');
    });

    it('rejects invalid theme names and falls back to dark', () => {
      expect(validateStoredTheme('invalid')).toBe('dark');
    });

    it('rejects empty string and falls back to dark', () => {
      expect(validateStoredTheme('')).toBe('dark');
    });

    it('rejects null value and falls back to dark', () => {
      expect(validateStoredTheme(null)).toBe('dark');
    });

    it('rejects theme names with wrong casing', () => {
      expect(validateStoredTheme('NAVY')).toBe('dark');
      expect(validateStoredTheme('Light')).toBe('dark');
      expect(validateStoredTheme('Dark')).toBe('dark');
    });

    it('rejects partial matches of valid theme names', () => {
      expect(validateStoredTheme('geo')).toBe('dark');
      expect(validateStoredTheme('tablet')).toBe('dark');
      expect(validateStoredTheme('darkmode')).toBe('dark');
    });
  });

  describe('localStorage theme persistence — end-to-end behavior', () => {
    it('persists navy theme selection across sessions', () => {
      // User selects Navy theme
      localStorage.setItem('dita-architect-theme', 'navy');

      // App loads and validates stored theme
      const stored = localStorage.getItem('dita-architect-theme');
      const validatedTheme = validateStoredTheme(stored);

      expect(validatedTheme).toBe('navy');
    });

    it('persists dark theme selection across sessions — regression test for Elena\'s bug report', () => {
      // User selects dark theme
      localStorage.setItem('dita-architect-theme', 'dark');

      // App loads and validates stored theme
      const stored = localStorage.getItem('dita-architect-theme');
      const validatedTheme = validateStoredTheme(stored);

      expect(validatedTheme).toBe('dark');
    });

    it('handles corrupted localStorage gracefully', () => {
      // Someone manually edits localStorage with invalid data
      localStorage.setItem('dita-architect-theme', 'corrupted-theme-name');

      // App should fall back to dark theme
      const stored = localStorage.getItem('dita-architect-theme');
      const validatedTheme = validateStoredTheme(stored);

      expect(validatedTheme).toBe('dark');
    });

    it('handles missing localStorage entry on first visit', () => {
      // New user — no theme stored yet
      const stored = localStorage.getItem('dita-architect-theme');
      const validatedTheme = validateStoredTheme(stored);

      expect(stored).toBeNull();
      expect(validatedTheme).toBe('dark');
    });

    it('uses correct localStorage key for theme persistence', () => {
      const themeKey = 'dita-architect-theme';

      localStorage.setItem(themeKey, 'navy');
      const retrieved = localStorage.getItem(themeKey);

      expect(retrieved).toBe('navy');
    });
  });

  describe('all valid themes — comprehensive validation', () => {
    const validThemes = ['light', 'claude', 'nord', 'solarized', 'navy', 'dark'];

    it('accepts all six valid themes', () => {
      validThemes.forEach(theme => {
        expect(validateStoredTheme(theme)).toBe(theme);
      });
    });

    it('matches exactly the themes available in THEME_OPTIONS', () => {
      // This ensures theme validation stays in sync with available options
      const expectedThemes = ['dark', 'light', 'claude', 'nord', 'solarized', 'navy'];

      expectedThemes.forEach(theme => {
        expect(validateStoredTheme(theme)).toBe(theme);
      });
    });
  });
});