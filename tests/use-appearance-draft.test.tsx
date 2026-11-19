// @vitest-environment jsdom
//
// FR-082 (v1.3.1, amends ADR-018 decision 1) — editing a built-in profile starts an
// unsaved draft: a custom profile in memory, applied live, stored nowhere until
// "Save as new profile". The built-in never changes; discarding leaves no override
// on <html> (A1's no-leak rule); a relaunch never sees a half-made draft.
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppearance } from '../hooks/useAppearance';
import { SETTINGS_KEY } from '../lib/settings';
import { BUILT_IN_PROFILES, THEME_VALUES } from '../lib/appearance';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; }, clear: () => m.clear(), key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null), removeItem: (k: string) => { m.delete(k); },
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
  } as Storage;
}
let store: Storage;
const html = () => document.documentElement;
const storedAppearance = () => { const raw = store.getItem(SETTINGS_KEY); return raw ? JSON.parse(raw).appearance : null; };

beforeEach(() => {
  store = memoryStorage();
  Object.defineProperty(window, 'localStorage', { value: store, writable: true, configurable: true });
  html().removeAttribute('data-theme');
  html().removeAttribute('style');
});

const open = (id = 'builtin:light') => {
  const h = renderHook(() => useAppearance());
  act(() => { h.result.current.selectProfile(id); });
  return h;
};

describe('FR-082 — a draft from a built-in', () => {
  it('the first edit starts a draft named "<built-in> (edited)", applied live, with nothing stored', () => {
    const h = open();
    let ok = false;
    act(() => { ok = h.result.current.setOverride('builtin:light', '--editor-accent', '#b45309'); });
    expect(ok).toBe(true);
    expect(h.result.current.draft).toEqual({ sourceId: 'builtin:light', sourceName: 'Light' });
    expect(h.result.current.active).toMatchObject({ name: 'Light (edited)', base: 'light', builtIn: false });
    expect(html().style.getPropertyValue('--editor-accent')).toBe('#b45309');
    expect(h.result.current.profiles.map(p => p.name)).toContain('Light (edited)');
    // the stored slice is untouched: no draft profile, and the active profile is still the built-in
    expect(storedAppearance()).toEqual({ activeProfileId: 'builtin:light', profiles: [] });
  });

  it('further edits go to the same draft (colours, base, syntax theme); the built-in stays as it was', () => {
    const h = open('builtin:warm-paper');
    act(() => { h.result.current.setOverride('builtin:warm-paper', '--app-bg', '#101010'); });
    act(() => { h.result.current.setOverride('draft', '--editor-h1', '#222222'); });
    act(() => { h.result.current.update('draft', { syntaxTheme: 'github' }); });
    const d = h.result.current.active;
    expect(d.id).toBe('draft');
    expect(d.overrides).toMatchObject({ '--app-bg': '#101010', '--editor-h1': '#222222', '--editor-page-bg': '#fffaf0' });
    expect(d.syntaxTheme).toBe('github');
    const wp = BUILT_IN_PROFILES.find(p => p.id === 'builtin:warm-paper')!;
    expect(wp.overrides['--editor-h1' as never]).toBe('#3b2a1a');
    expect(THEME_VALUES.light['--editor-h1']).not.toBe('#222222');
  });

  it('an edit the model refuses starts no draft; a value equal to the base starts none either', () => {
    const h = open();
    let ok = true;
    act(() => { ok = h.result.current.setOverride('builtin:light', '--app-bg', 'url(x)'); });
    expect(ok).toBe(false);
    act(() => { h.result.current.setOverride('builtin:light', '--app-bg', THEME_VALUES.light['--app-bg']); });
    expect(h.result.current.draft).toBeNull();
    expect(h.result.current.active.id).toBe('builtin:light');
  });

  it('Save as new profile adds exactly one custom profile with the draft\'s content, activates it, and clears the draft', () => {
    const h = open();
    act(() => { h.result.current.setOverride('builtin:light', '--editor-accent', '#b45309'); });
    act(() => { h.result.current.update('draft', { syntaxTheme: 'monokai' }); });
    let id: string | null = null;
    act(() => { id = h.result.current.saveDraft('My light'); });
    expect(id).toMatch(/^p-/);
    expect(h.result.current.draft).toBeNull();
    expect(h.result.current.active).toMatchObject({ id, name: 'My light', base: 'light', syntaxTheme: 'monokai', builtIn: false, overrides: { '--editor-accent': '#b45309' } });
    expect(storedAppearance()).toMatchObject({ activeProfileId: id, profiles: [{ id, name: 'My light' }] });
    expect(storedAppearance().profiles.length).toBe(1);
  });

  it('a taken name gets a number; an empty name is refused and keeps the draft', () => {
    const h = open();
    act(() => { h.result.current.setOverride('builtin:light', '--editor-accent', '#b45309'); });
    let id: string | null = 'x';
    act(() => { id = h.result.current.saveDraft('   '); });
    expect(id).toBeNull();
    expect(h.result.current.draft).not.toBeNull();
    act(() => { h.result.current.saveDraft('Dark'); });
    expect(h.result.current.active.name).toBe('Dark 2');
  });

  it('Discard returns to the built-in exactly: no override left on <html>, nothing stored', () => {
    const h = open('builtin:nord');
    act(() => { h.result.current.setOverride('builtin:nord', '--editor-accent', '#ff0000'); });
    expect(html().style.getPropertyValue('--editor-accent')).toBe('#ff0000');
    act(() => { h.result.current.discardDraft(); });
    expect(h.result.current.draft).toBeNull();
    expect(h.result.current.active.id).toBe('builtin:nord');
    expect(html().style.getPropertyValue('--editor-accent')).toBe('');
    expect(html().getAttribute('data-theme')).toBe('nord');
    expect(storedAppearance()).toEqual({ activeProfileId: 'builtin:nord', profiles: [] });
  });

  it('selecting another profile drops the draft (the drawer asks first)', () => {
    const h = open();
    act(() => { h.result.current.setOverride('builtin:light', '--editor-accent', '#b45309'); });
    act(() => { h.result.current.selectProfile('builtin:navy'); });
    expect(h.result.current.draft).toBeNull();
    expect(h.result.current.active.id).toBe('builtin:navy');
    expect(html().style.getPropertyValue('--editor-accent')).toBe('');
  });

  it('a relaunch never shows a draft: a fresh hook reads the built-in', () => {
    const first = open();
    act(() => { first.result.current.setOverride('builtin:light', '--editor-accent', '#b45309'); });
    first.unmount();
    html().removeAttribute('style');
    const second = renderHook(() => useAppearance());
    expect(second.result.current.draft).toBeNull();
    expect(second.result.current.active.id).toBe('builtin:light');
    expect(html().style.getPropertyValue('--editor-accent')).toBe('');
  });

  it('editing a custom profile still saves in place, with no draft (Duplicate and Import unchanged)', () => {
    const h = open();
    let id: string | null = null;
    act(() => { id = h.result.current.duplicate('builtin:light'); });
    act(() => { h.result.current.setOverride(id!, '--editor-accent', '#b45309'); });
    expect(h.result.current.draft).toBeNull();
    expect(storedAppearance().profiles[0].overrides).toEqual({ '--editor-accent': '#b45309' });
  });
});
