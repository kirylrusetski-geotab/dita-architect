// @vitest-environment jsdom
//
// ADR-018 — the appearance hook: reads the store's slice, applies the active
// profile to <html> on mount and on every change (decision 3), persists, and
// answers the drawer's actions through the pure model.
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppearance } from '../hooks/useAppearance';
import { SETTINGS_KEY, LEGACY_KEYS } from '../lib/settings';

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
const stored = () => JSON.parse(store.getItem(SETTINGS_KEY)!).appearance;

beforeEach(() => {
  store = memoryStorage();
  Object.defineProperty(window, 'localStorage', { value: store, writable: true, configurable: true });
  html().removeAttribute('data-theme');
  html().removeAttribute('style');
});

describe('useAppearance', () => {
  it('a fresh install applies Dark on mount', () => {
    const { result } = renderHook(() => useAppearance());
    expect(result.current.active.id).toBe('builtin:dark');
    expect(html().getAttribute('data-theme')).toBe('dark');
  });

  it('a v1.2.0 user with Nord + Dracula opens on the migrated profile: same base, same syntax theme', () => {
    store.setItem(LEGACY_KEYS.theme, 'nord');
    store.setItem(LEGACY_KEYS.syntaxTheme, 'dracula');
    const { result } = renderHook(() => useAppearance());
    expect(result.current.active).toMatchObject({ name: 'Nord, Dracula XML', base: 'nord', syntaxTheme: 'dracula' });
    expect(html().getAttribute('data-theme')).toBe('nord');
    expect(store.getItem(LEGACY_KEYS.theme)).toBeNull();
  });

  it('selecting a profile applies and persists it; an unknown id changes nothing', () => {
    const { result } = renderHook(() => useAppearance());
    act(() => { result.current.selectProfile('builtin:solarized'); });
    expect(html().getAttribute('data-theme')).toBe('solarized');
    expect(stored().activeProfileId).toBe('builtin:solarized');
    let ok = true;
    act(() => { ok = result.current.selectProfile('nope'); });
    expect(ok).toBe(false);
    expect(result.current.active.id).toBe('builtin:solarized');
  });

  it('duplicate → override → the change is on <html> at once and in the store; reset and delete fall back', () => {
    const { result } = renderHook(() => useAppearance());
    let id: string | null = null;
    act(() => { id = result.current.duplicate('builtin:light'); });
    expect(id).toMatch(/^p-/);
    expect(result.current.active).toMatchObject({ id, name: 'Light copy', base: 'light', builtIn: false });
    act(() => { result.current.setOverride(id!, '--editor-accent', '#b45309'); });
    expect(html().style.getPropertyValue('--editor-accent')).toBe('#b45309');
    expect(stored().profiles[0].overrides).toEqual({ '--editor-accent': '#b45309' });
    act(() => { result.current.resetOverrides(id!); });
    expect(html().style.getPropertyValue('--editor-accent')).toBe('');
    act(() => { result.current.remove(id!); });
    expect(result.current.active.id).toBe('builtin:light');
    expect(stored()).toEqual({ activeProfileId: 'builtin:light', profiles: [] });
  });

  it('setOverride says whether the value was accepted; a refused value changes nothing', () => {
    const { result } = renderHook(() => useAppearance());
    let id: string | null = null;
    act(() => { id = result.current.duplicate('builtin:dark'); });
    let accepted = true;
    act(() => { accepted = result.current.setOverride(id!, '--app-bg', 'url(x)'); });
    expect(accepted).toBe(false);
    expect(result.current.active.overrides).toEqual({});
    act(() => { accepted = result.current.setOverride('builtin:dark', '--app-bg', '#000000'); });
    expect(accepted).toBe(false);
  });

  it('import adds and activates; a refused import leaves the state alone; export of any profile is the file', () => {
    const { result } = renderHook(() => useAppearance());
    const text = result.current.exportText('builtin:navy')!;
    expect(JSON.parse(text)).toMatchObject({ base: 'navy', name: 'Navy' });
    let ok = false;
    act(() => { ok = result.current.importText(text).ok; });
    expect(ok).toBe(true);
    expect(result.current.active).toMatchObject({ name: 'Navy 2', base: 'navy', builtIn: false });
    const before = result.current.state;
    act(() => { ok = result.current.importText('{"format":"x"}').ok; });
    expect(ok).toBe(false);
    expect(result.current.state).toBe(before);
    expect(result.current.exportText('gone')).toBeNull();
  });
});
