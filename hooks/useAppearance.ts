import { useCallback, useLayoutEffect, useEffect, useMemo, useRef, useState } from 'react';
import {
  allProfiles,
  applyProfile,
  deleteProfile,
  duplicateProfile,
  exportProfile,
  findProfile,
  importProfile,
  isValidValue,
  resetOverrides as resetOverridesPure,
  resolveActiveProfile,
  setActiveProfile,
  setOverride as setOverridePure,
  updateProfile,
  type AppearanceState,
  type ImportResult,
  type SyntaxThemeName,
  type ThemeName,
} from '../lib/appearance';
import type { AppearanceVar } from '../constants/appearance-vars';
import { loadSettings, updateSettings, SETTINGS_KEY } from '../lib/settings';

const newProfileId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `p-${crypto.randomUUID()}`
    : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * ADR-018 — the one owner of the appearance state. Reads the settings store's
 * `appearance` slice once, applies the active profile to `<html>` on every
 * change (decision 3), and writes the slice back. Every action is a pure
 * function from lib/appearance.ts; an action the model refuses changes nothing.
 */
export function useAppearance(root: HTMLElement | null = typeof document !== 'undefined' ? document.documentElement : null) {
  const [state, setState] = useState<AppearanceState>(() => loadSettings().appearance);
  const active = useMemo(() => resolveActiveProfile(state), [state]);
  const profiles = useMemo(() => allProfiles(state), [state]);

  useLayoutEffect(() => {
    if (root) applyProfile(root, active);
  }, [root, active]);

  // The latest state for actions that must answer synchronously (duplicate, import).
  const stateRef = useRef(state);
  stateRef.current = state;

  // Persist on change, not on mount (the store already holds what was read), and not when
  // the change came from the store itself (another window's write, below).
  const skipWrite = useRef(true);
  useEffect(() => {
    if (skipWrite.current) { skipWrite.current = false; return; }
    updateSettings(s => ({ ...s, appearance: state }));
  }, [state]);

  // Review finding: two browser windows each wrote their whole appearance slice, so the
  // last writer erased a profile the other had just made. Another window's write to the
  // store arrives as a `storage` event; take its appearance slice before writing again.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SETTINGS_KEY) return;
      const next = loadSettings().appearance;
      if (JSON.stringify(next) === JSON.stringify(stateRef.current)) return;
      skipWrite.current = true;
      stateRef.current = next;
      setState(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const commit = useCallback((next: AppearanceState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const selectProfile = useCallback((id: string): boolean => {
    const next = setActiveProfile(stateRef.current, id);
    if (next !== stateRef.current) commit(next);
    return !!findProfile(stateRef.current, id);
  }, [commit]);

  /** Returns the new profile's id, or null when the source does not exist. */
  const duplicate = useCallback((sourceId: string): string | null => {
    const id = newProfileId();
    const next = duplicateProfile(stateRef.current, sourceId, id);
    if (next === stateRef.current) return null;
    commit(next);
    return id;
  }, [commit]);

  const update = useCallback((id: string, patch: { name?: string; base?: ThemeName; syntaxTheme?: SyntaxThemeName }) => {
    commit(updateProfile(stateRef.current, id, patch));
  }, [commit]);

  /** False when the value was refused (decision 4); null resets the variable to the base. */
  const setOverride = useCallback((id: string, name: AppearanceVar, value: string | null): boolean => {
    const before = stateRef.current;
    const next = setOverridePure(before, id, name, value);
    if (next !== before) commit(next);
    // Accepted means: a custom profile, and either a reset or a value that passes the check
    // (a value equal to the base's is accepted and simply not stored).
    const p = findProfile(next, id);
    return !!p && !p.builtIn && (value === null || isValidValue(name, value));
  }, [commit]);

  const resetOverrides = useCallback((id: string) => commit(resetOverridesPure(stateRef.current, id)), [commit]);
  const remove = useCallback((id: string) => commit(deleteProfile(stateRef.current, id)), [commit]);

  const importText = useCallback((text: string): ImportResult => {
    const res = importProfile(stateRef.current, text, newProfileId());
    if (res.ok) commit(res.state);
    return res;
  }, [commit]);

  const exportText = useCallback((id: string): string | null => {
    const p = findProfile(stateRef.current, id);
    return p ? exportProfile(p) : null;
  }, []);

  return { state, active, profiles, selectProfile, duplicate, update, setOverride, resetOverrides, remove, importText, exportText };
}

export type AppearanceApi = ReturnType<typeof useAppearance>;
