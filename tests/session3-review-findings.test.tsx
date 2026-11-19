// @vitest-environment jsdom
//
// ADR-018 implementation note — the fresh-context adversarial review's findings
// for v1.3.0, each pinned. Defects: a stuck "Changed only" on a built-in; a
// stale name field after a colliding rename; user-facing strings naming the
// retired Heretto Status modal. Weaknesses: two windows erasing each other's
// profiles; an unreadable store replaced with no copy kept; a newer store
// overwritten by an older app; a base change losing overrides; the title row
// clickable through the drawer; a typed name lost on Escape; an unknown stored
// syntax theme migrating to a different look; #rrggbbaa without a picker.
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen, fireEvent, within, renderHook, act } from '@testing-library/react';
import { AppearanceDrawer } from '../components/AppearanceDrawer';
import { useAppearance } from '../hooks/useAppearance';
import { SETTINGS_KEY, SETTINGS_BACKUP_KEY, loadSettings, updateSettings } from '../lib/settings';
import { DEFAULT_APPEARANCE, duplicateProfile, setOverride, updateProfile, resolveActiveProfile, migrateThemePair, parseColour } from '../lib/appearance';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; }, clear: () => m.clear(), key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null), removeItem: (k: string) => { m.delete(k); },
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
  } as Storage;
}
let store: Storage;
beforeEach(() => {
  store = memoryStorage();
  Object.defineProperty(window, 'localStorage', { value: store, writable: true, configurable: true });
  document.documentElement.removeAttribute('style');
});

const Harness = ({ onClose = () => {} }: { onClose?: () => void }) => <AppearanceDrawer appearance={useAppearance()} onClose={onClose} />;
const list = () => within(screen.getByRole('listbox', { name: 'Profiles' }));

describe('defects', () => {
  it('"Changed only" does not hide every row on a built-in, and comes back on the custom profile', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /^Duplicate$/ }));
    fireEvent.click(screen.getByLabelText('Changed only'));
    fireEvent.click(list().getByRole('option', { name: 'Dark' }));
    expect(screen.getByLabelText('Changed only')).not.toBeChecked();
    expect(screen.getByLabelText('Window background value')).toBeInTheDocument();
    fireEvent.click(list().getByRole('option', { name: 'Dark copy' }));
    expect(screen.getByLabelText('Changed only')).toBeChecked();
  });

  it('a rename that collides shows the stored name in the field ("Light" → "Light 2")', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /^Duplicate$/ }));
    const name = screen.getByLabelText('Name');
    fireEvent.change(name, { target: { value: 'Light' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(screen.getByLabelText('Name')).toHaveValue('Light 2');
    expect(list().getByRole('option', { name: 'Light 2' })).toBeInTheDocument();
  });

  it('a typed name is kept when the drawer closes with Escape (no blur fires)', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /^Duplicate$/ }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Paper' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(JSON.parse(store.getItem(SETTINGS_KEY)!).appearance.profiles[0].name).toBe('Paper');
  });

  it('no user-visible string names the retired Heretto Status modal', () => {
    const src = readFileSync(join(__dirname, '..', 'hooks', 'useHerettoCms.ts'), 'utf-8');
    expect(src).not.toMatch(/['`][^'`]*Heretto Status[^'`]*['`]/);
    expect(src).toMatch(/Settings ▸ Heretto/);
  });
});

describe('weaknesses', () => {
  it('two windows: a profile made in one survives an edit in the other (the storage event syncs the slice)', () => {
    const a = renderHook(() => useAppearance(null));
    const b = renderHook(() => useAppearance(null));
    let id: string | null = null;
    act(() => { id = a.result.current.duplicate('builtin:nord'); });
    // The browser delivers a storage event to the other window only.
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: SETTINGS_KEY })); });
    expect(b.result.current.profiles.some(p => p.id === id)).toBe(true);
    act(() => { b.result.current.selectProfile('builtin:light'); });
    const stored = JSON.parse(store.getItem(SETTINGS_KEY)!).appearance;
    expect(stored.profiles.map((p: { id: string }) => p.id)).toContain(id);
  });

  it('an unreadable store is copied aside before migration replaces it', () => {
    store.setItem(SETTINGS_KEY, '{"version":1,"appearance":{"profiles":[{"id":"p","na');
    loadSettings(store);
    expect(store.getItem(SETTINGS_BACKUP_KEY)).toBe('{"version":1,"appearance":{"profiles":[{"id":"p","na');
  });

  it('a store written by a newer version is read but never overwritten', () => {
    const newer = JSON.stringify({ version: 2, editor: { wordWrap: true }, futureSlice: { x: 1 } });
    store.setItem(SETTINGS_KEY, newer);
    expect(loadSettings(store).editor.wordWrap).toBe(true);
    updateSettings(s => ({ ...s, editor: { ...s.editor, wordWrap: false } }), store);
    expect(store.getItem(SETTINGS_KEY)).toBe(newer);
  });

  it('a base change keeps every override, so switching back loses nothing', () => {
    let s = duplicateProfile(DEFAULT_APPEARANCE, 'builtin:dark', 'p');
    s = setOverride(s, 'p', '--app-bg', '#f5f5f4'); // equals Light's --app-bg
    s = updateProfile(s, 'p', { base: 'light' });
    s = updateProfile(s, 'p', { base: 'dark' });
    expect(resolveActiveProfile(s).overrides).toEqual({ '--app-bg': '#f5f5f4' });
  });

  it('the drawer\'s overlay covers the title row too (no click-through while the dialog is modal)', () => {
    render(<Harness />);
    expect(screen.getByTestId('modal-overlay').className).toMatch(/^fixed inset-0 /);
  });

  it('an unknown stored syntax theme migrates to Material (what v1.2.0 showed), not to the base\'s pairing', () => {
    const s = migrateThemePair('light', 'solarized-dark');
    expect(resolveActiveProfile(s)).toMatchObject({ base: 'light', syntaxTheme: 'material' });
    expect(migrateThemePair('light', null)).toEqual({ activeProfileId: 'builtin:light', profiles: [] });
  });

  it('#rrggbbaa gets a picker and keeps its alpha', () => {
    expect(parseColour('#38bdf880')).toEqual({ hex: '#38bdf8', alpha: '0.5' });
  });
});
