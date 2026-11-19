/**
 * ADR-018 decisions 7–8 — one versioned settings store.
 *
 * Every preference the app persists lives in one `localStorage` value,
 * `dita-architect-settings`. Each slice is parsed on its own, so a bad slice
 * falls back to its defaults without touching the others. Consumers keep their
 * own React state and write their slice through `updateSettings`.
 *
 * When the store is absent (or unreadable) the seven keys v1.2.0 wrote are
 * migrated into it once, and removed only after the store was written and read
 * back. The connected map is not a setting (ADR-013 session state) and stays
 * in its own key.
 */
import { defaultLayout, parseStoredLayout, serializeLayout, type WorkbenchLayout } from './workbench-layout';
import { DEFAULT_APPEARANCE, migrateThemePair, parseStoredAppearance, type AppearanceState } from './appearance';

export const SETTINGS_KEY = 'dita-architect-settings';
/** A stored value that could not be read is copied here before it is replaced, so nothing is lost silently. */
export const SETTINGS_BACKUP_KEY = 'dita-architect-settings.unreadable';
export const SETTINGS_VERSION = 1;

/** The keys v1.2.0 wrote, each migrated once (decision 8). */
export const LEGACY_KEYS = {
  wordWrap: 'ditaWordWrap',
  splitWidth: 'ditaSplitWidth',
  theme: 'dita-architect-theme',
  syntaxTheme: 'dita-architect-syntax-theme',
  lastSeenVersion: 'dita-architect-last-seen-version',
  workbench: 'dita-architect-workbench',
  syncHint: 'dita-architect-coach-sync-hint',
} as const;

export interface EditorSettings {
  /** Word wrap in the XML split. */
  wordWrap: boolean;
  /** ADR-018 decision 10: open the XML split when a topic opens (off: ADR-017's closed-by-default). */
  openXmlTrayOnLoad: boolean;
  /** The one-time sync hint (the coach mark); dismissing it sets this false. */
  showSyncHint: boolean;
}

export interface Settings {
  version: typeof SETTINGS_VERSION;
  workbench: WorkbenchLayout;
  appearance: AppearanceState;
  editor: EditorSettings;
  /** The release whose notes were last shown ("What's New" opens once per new version). */
  lastSeenVersion: string | null;
}

const DEFAULT_EDITOR: EditorSettings = { wordWrap: false, openXmlTrayOnLoad: false, showSyncHint: true };

export function defaultSettings(): Settings {
  return { version: SETTINGS_VERSION, workbench: defaultLayout(), appearance: DEFAULT_APPEARANCE, editor: { ...DEFAULT_EDITOR }, lastSeenVersion: null };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function parseEditor(v: unknown): EditorSettings {
  const out = { ...DEFAULT_EDITOR };
  if (!isObject(v)) return out;
  for (const k of Object.keys(DEFAULT_EDITOR) as (keyof EditorSettings)[]) if (typeof v[k] === 'boolean') out[k] = v[k] as boolean;
  return out;
}

/** The stored text → Settings, slice by slice; null when it is not a settings object at all. */
export function parseSettings(raw: string | null | undefined): Settings | null {
  if (!raw) return null;
  let o: unknown;
  try { o = JSON.parse(raw); } catch { return null; }
  if (!isObject(o) || typeof o.version !== 'number') return null;
  return {
    version: SETTINGS_VERSION,
    workbench: isObject(o.workbench) ? parseStoredLayout(JSON.stringify(o.workbench)) : defaultLayout(),
    appearance: parseStoredAppearance(o.appearance),
    editor: parseEditor(o.editor),
    lastSeenVersion: typeof o.lastSeenVersion === 'string' ? o.lastSeenVersion : null,
  };
}

function toStored(s: Settings): string {
  return JSON.stringify({ ...s, workbench: JSON.parse(serializeLayout(s.workbench)) });
}

/** Decision 8: build the store from the v1.2.0 keys (pure; `get` reads one key). */
export function migrateLegacy(get: (key: string) => string | null): Settings {
  return {
    version: SETTINGS_VERSION,
    workbench: parseStoredLayout(get(LEGACY_KEYS.workbench), get(LEGACY_KEYS.splitWidth)),
    appearance: migrateThemePair(get(LEGACY_KEYS.theme), get(LEGACY_KEYS.syntaxTheme)),
    editor: {
      wordWrap: get(LEGACY_KEYS.wordWrap) === 'true',
      openXmlTrayOnLoad: false,
      showSyncHint: get(LEGACY_KEYS.syncHint) === null,
    },
    lastSeenVersion: get(LEGACY_KEYS.lastSeenVersion),
  };
}

/** `window.localStorage`, or null when a private window or a blocked origin throws on access. */
export function browserStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

const safeGet = (st: Storage, key: string): string | null => {
  try { return st.getItem(key); } catch { return null; }
};

/** The `version` of the stored value, or null when there is none or it does not parse. */
function storedVersion(st: Storage): number | null {
  try {
    const o: unknown = JSON.parse(safeGet(st, SETTINGS_KEY) ?? '');
    return isObject(o) && typeof o.version === 'number' ? o.version : null;
  } catch {
    return null;
  }
}

/**
 * Writes the store; false (never a throw) when the write was refused. A store
 * written by a newer version of the app is never overwritten: this session
 * runs on what it read, and the newer slices this version does not know survive.
 */
export function saveSettings(s: Settings, st: Storage | null = browserStorage()): boolean {
  if (!st) return false;
  const v = storedVersion(st);
  if (v !== null && v > SETTINGS_VERSION) return false;
  try {
    st.setItem(SETTINGS_KEY, toStored(s));
    return true;
  } catch {
    return false;
  }
}

/**
 * The store, migrating the legacy keys the first time. The legacy keys are
 * removed only once the new value has been written and reads back equal; if
 * the write fails they stay, and this session runs on the migrated values.
 */
export function loadSettings(st: Storage | null = browserStorage()): Settings {
  if (!st) return defaultSettings();
  const raw = safeGet(st, SETTINGS_KEY);
  const existing = parseSettings(raw);
  if (existing) return existing;
  // A value that is there but unreadable (a truncated write, a hand edit) is kept aside
  // before migration replaces it, so custom profiles can be recovered by hand.
  if (raw) {
    try { st.setItem(SETTINGS_BACKUP_KEY, raw); } catch { /* nothing more to do */ }
  }
  const migrated = migrateLegacy(k => safeGet(st, k));
  if (saveSettings(migrated, st)) {
    const back = parseSettings(safeGet(st, SETTINGS_KEY));
    if (back && toStored(back) === toStored(migrated)) {
      for (const k of Object.values(LEGACY_KEYS)) {
        try { st.removeItem(k); } catch { /* nothing to do */ }
      }
    }
  }
  return migrated;
}

/** Read, change, write: one slice at a time, the others as stored. */
export function updateSettings(fn: (s: Settings) => Settings, st: Storage | null = browserStorage()): Settings {
  const next = fn(loadSettings(st));
  saveSettings(next, st);
  return next;
}

/** ADR-018 decision 9: the Settings modal's pages, in order (the menu bridge's `openSettings(page)` takes these ids). */
export const SETTINGS_PAGES = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'heretto', label: 'Heretto' },
  { id: 'shortcuts', label: 'Keyboard Shortcuts' },
  { id: 'about', label: 'About' },
] as const;

export type SettingsPage = typeof SETTINGS_PAGES[number]['id'];

export function isSettingsPage(v: unknown): v is SettingsPage {
  return typeof v === 'string' && SETTINGS_PAGES.some(p => p.id === v);
}
