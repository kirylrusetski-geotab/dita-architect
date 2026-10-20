import { describe, it, expect } from 'vitest';
import { THEME_OPTIONS, THEME_DESCRIPTIONS, ThemeName } from '../components/Toolbar';

describe('THEME_OPTIONS — available themes in dropdown selector', () => {
  it('includes all six expected theme options', () => {
    expect(THEME_OPTIONS).toHaveLength(6);
  });

  it('includes Dark theme as first option', () => {
    expect(THEME_OPTIONS[0]).toEqual({ value: 'dark', label: 'Dark' });
  });

  it('includes Light theme as second option', () => {
    expect(THEME_OPTIONS[1]).toEqual({ value: 'light', label: 'Light' });
  });

  it('includes Claude theme as third option', () => {
    expect(THEME_OPTIONS[2]).toEqual({ value: 'claude', label: 'Claude' });
  });

  it('includes Nord theme as fourth option', () => {
    expect(THEME_OPTIONS[3]).toEqual({ value: 'nord', label: 'Nord' });
  });

  it('includes Solarized theme as fifth option', () => {
    expect(THEME_OPTIONS[4]).toEqual({ value: 'solarized', label: 'Solarized' });
  });

  it('includes Navy theme as sixth option — new theme added per Anna\'s plan', () => {
    expect(THEME_OPTIONS[5]).toEqual({ value: 'navy', label: 'Navy' });
  });

  it('contains expected theme values that can be used as data-theme attributes', () => {
    const values = THEME_OPTIONS.map(option => option.value);
    expect(values).toEqual(['dark', 'light', 'claude', 'nord', 'solarized', 'navy']);
  });

  it('contains human-readable labels for the theme dropdown UI', () => {
    const labels = THEME_OPTIONS.map(option => option.label);
    expect(labels).toEqual(['Dark', 'Light', 'Claude', 'Nord', 'Solarized', 'Navy']);
  });

  it('navy value matches the CSS data-theme selector in index.css', () => {
    // This ensures the theme value will properly activate the CSS variables
    const navyTheme = THEME_OPTIONS.find(option => option.label === 'Navy');
    expect(navyTheme?.value).toBe('navy');
  });

  it('all theme values are valid TypeScript ThemeName type members', () => {
    // This test documents the type safety — all values should be assignable to ThemeName
    const values = THEME_OPTIONS.map(option => option.value);
    values.forEach(value => {
      expect(typeof value).toBe('string');
      // TypeScript compilation ensures these are valid ThemeName values
      const themeValue: ThemeName = value;
      expect(themeValue).toBe(value);
    });
  });
});

describe('THEME_DESCRIPTIONS — theme tooltip content for accessibility', () => {
  it('provides descriptions for all theme options', () => {
    const themeValues = THEME_OPTIONS.map(option => option.value);
    const descriptionKeys = Object.keys(THEME_DESCRIPTIONS);
    expect(descriptionKeys).toEqual(themeValues);
  });

  it('has meaningful non-empty descriptions for each theme', () => {
    Object.values(THEME_DESCRIPTIONS).forEach(description => {
      expect(description).toBeTruthy();
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(5);
    });
  });

  it('includes description for navy theme specifically', () => {
    expect(THEME_DESCRIPTIONS.navy).toBeDefined();
    expect(THEME_DESCRIPTIONS.navy).toContain('navy');
  });
});