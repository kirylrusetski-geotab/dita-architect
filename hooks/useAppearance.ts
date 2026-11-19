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
  uniqueProfileName,
  type AppearanceProfile,
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

/** FR-082: the id of the unsaved draft made from a built-in profile. */
export const DRAFT_ID = 'draft';

interface Draft {
  sourceId: string;
  sourceName: string;
  profile: AppearanceProfile;
}

/** The stored state with the draft appended and active (what the app shows while a draft exists). */
const withDraft = (state: AppearanceState, draft: Draft | null): AppearanceState =>
  draft ? { activeProfileId: DRAFT_ID, profiles: [...state.profiles, draft.profile] } : state;

/**
 * ADR-018 — the one owner of the appearance state. Reads the settings store's
 * `appearance` slice once, applies the active profile to `<html>` on every
 * change (decision 3), and writes the slice back. Every action is a pure
 * function from lib/appearance.ts; an action the model refuses changes nothing.
 *
 * FR-082 (v1.3.1): the first edit to a built-in starts a **draft**, a custom profile
 * held in memory only. It is applied live and shown as the active profile, but it is
 * never part of the stored slice: `saveDraft` turns it into a real custom profile,
 * `discardDraft` drops it, and a relaunch never sees it. The built-in is never changed.
 */
export function useAppearance(root: HTMLElement | null = typeof document !== 'undefined' ? document.documentElement : null) {
  const [stored, setState] = useState<AppearanceState>(() => loadSettings().appearance);
  const [draft, setDraftState] = useState<Draft | null>(null);
  // What the app shows: the stored state, or the draft over it.
  const state = useMemo(() => withDraft(stored, draft), [stored, draft]);
  const active = useMemo(() => resolveActiveProfile(state), [state]);
  const profiles = useMemo(() => allProfiles(state), [state]);

  useLayoutEffect(() => {
    if (root) applyProfile(root, active);
  }, [root, active]);

  // The latest state for actions that must answer synchronously (duplicate, import).
  const stateRef = useRef(stored);
  stateRef.current = stored;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const setDraft = useCallback((d: Draft | null) => { draftRef.current = d; setDraftState(d); }, []);

  // Persist on change, not on mount (the store already holds what was read), and not when
  // the change came from the store itself (another window's write, below).
  const skipWrite = useRef(true);
  useEffect(() => {
    if (skipWrite.current) { skipWrite.current = false; return; }
    updateSettings(s => ({ ...s, appearance: stored }));
  }, [stored]);

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
    setDraft(null);
    const next = setActiveProfile(stateRef.current, id);
    if (next !== stateRef.current) commit(next);
    return !!findProfile(stateRef.current, id);
  }, [commit, setDraft]);

  /** Returns the new profile's id, or null when the source does not exist. */
  const duplicate = useCallback((sourceId: string): string | null => {
    const id = newProfileId();
    const next = duplicateProfile(stateRef.current, sourceId, id);
    if (next === stateRef.current) return null;
    setDraft(null);
    commit(next);
    return id;
  }, [commit, setDraft]);

  /**
   * Run `op` on the profile `id`. A custom profile (or the draft) is changed in place; the
   * first change to a built-in starts the draft instead. An op the model refuses (it returns
   * the state it was given) starts nothing. Returns the state it ran on and the result.
   */
  const mutate = useCallback((id: string, op: (s: AppearanceState, id: string) => AppearanceState) => {
    const current = withDraft(stateRef.current, draftRef.current);
    const target = findProfile(current, id);
    if (!target) return { before: current, after: current, profile: undefined as AppearanceProfile | undefined };
    let base = current;
    let targetId = id;
    let source: { id: string; name: string } | null = null;
    if (target.builtIn) {
      // The first edit to a built-in: work on a draft copy (not stored, not the built-in).
      const copy: AppearanceProfile = {
        ...target, id: DRAFT_ID, builtIn: false, overrides: { ...target.overrides },
        name: uniqueProfileName(stateRef.current, `${target.name} (edited)`),
      };
      base = { activeProfileId: DRAFT_ID, profiles: [...stateRef.current.profiles, copy] };
      targetId = DRAFT_ID;
      source = { id: target.id, name: target.name };
    }
    const after = op(base, targetId);
    if (after === base) return { before: current, after: current, profile: findProfile(current, id) };
    const edited = after.profiles.find(p => p.id === DRAFT_ID);
    const rest = after.profiles.filter(p => p.id !== DRAFT_ID);
    if (edited) {
      setDraft({ sourceId: draftRef.current?.sourceId ?? source!.id, sourceName: draftRef.current?.sourceName ?? source!.name, profile: edited });
    }
    // The stored active id never becomes the draft's.
    const activeId = after.activeProfileId === DRAFT_ID ? stateRef.current.activeProfileId : after.activeProfileId;
    if (rest.length !== stateRef.current.profiles.length || rest.some((p, i) => p !== stateRef.current.profiles[i]) || activeId !== stateRef.current.activeProfileId) {
      commit({ activeProfileId: activeId, profiles: rest });
    }
    return { before: current, after, profile: findProfile(after, targetId) };
  }, [commit, setDraft]);

  const update = useCallback((id: string, patch: { name?: string; base?: ThemeName; syntaxTheme?: SyntaxThemeName }) => {
    mutate(id, (s, target) => updateProfile(s, target, patch));
  }, [mutate]);

  /** False when the value was refused (decision 4); null resets the variable to the base. */
  const setOverride = useCallback((id: string, name: AppearanceVar, value: string | null): boolean => {
    const { after, profile } = mutate(id, (s, target) => setOverridePure(s, target, name, value));
    // Accepted means: an editable profile (custom, or a built-in whose edit starts a draft), and either
    // a reset or a value that passes the check (one equal to the base's is accepted and not stored).
    return !!profile && !!after && (value === null || isValidValue(name, value));
  }, [mutate]);

  const resetOverrides = useCallback((id: string) => { mutate(id, (s, target) => resetOverridesPure(s, target)); }, [mutate]);
  const remove = useCallback((id: string) => commit(deleteProfile(stateRef.current, id)), [commit]);

  const importText = useCallback((text: string): ImportResult => {
    const res = importProfile(stateRef.current, text, newProfileId());
    if (res.ok) { setDraft(null); commit(res.state); }
    return res;
  }, [commit, setDraft]);

  /** FR-082: keep the draft as a new custom profile (named, active). Null, with the draft kept, when the name is empty. */
  const saveDraft = useCallback((name: string): string | null => {
    const d = draftRef.current;
    const trimmed = name.trim();
    if (!d || !trimmed) return null;
    const id = newProfileId();
    const profile: AppearanceProfile = { ...d.profile, id, name: uniqueProfileName(stateRef.current, trimmed), builtIn: false };
    setDraft(null);
    commit({ activeProfileId: id, profiles: [...stateRef.current.profiles, profile] });
    return id;
  }, [commit, setDraft]);

  /** FR-082: drop the draft; the app returns to the stored active profile (the built-in the draft came from). */
  const discardDraft = useCallback(() => { setDraft(null); }, [setDraft]);

  const exportText = useCallback((id: string): string | null => {
    const p = findProfile(stateRef.current, id);
    return p ? exportProfile(p) : null;
  }, []);

  const draftInfo = useMemo(() => (draft ? { sourceId: draft.sourceId, sourceName: draft.sourceName } : null), [draft]);

  return { state, active, profiles, draft: draftInfo, selectProfile, duplicate, update, setOverride, resetOverrides, remove, importText, exportText, saveDraft, discardDraft };
}

export type AppearanceApi = ReturnType<typeof useAppearance>;
