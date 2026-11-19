// ADR-018 decisions 7–8 — the settings store (lib/settings.ts): one versioned
// object, tolerant slice by slice, and the one-time migration of the seven
// v1.2.0 keys (A2's store half, ST1). A test per legacy key, as FR-074 asks.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  SETTINGS_KEY, LEGACY_KEYS, defaultSettings, loadSettings, saveSettings, updateSettings, migrateLegacy, parseSettings,
} from '../lib/settings';
import { defaultLayout, serializeLayout } from '../lib/workbench-layout';
import { DEFAULT_APPEARANCE } from '../lib/appearance';

function memoryStorage(seed: Record<string, string> = {}): Storage & { failWrites?: boolean } {
  const m = new Map<string, string>(Object.entries(seed));
  const s = {
    failWrites: false,
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => { m.delete(k); },
    setItem: (k: string, v: string) => { if (s.failWrites) throw new DOMException('quota', 'QuotaExceededError'); m.set(k, String(v)); },
  };
  return s as unknown as Storage & { failWrites?: boolean };
}

const ALL_LEGACY = Object.values(LEGACY_KEYS);

describe('the seven legacy keys are the ones v1.2.0 wrote', () => {
  it('names exactly the seven, and not the connected map (session state, ADR-013)', () => {
    expect([...ALL_LEGACY].sort()).toEqual([
      'dita-architect-coach-sync-hint', 'dita-architect-last-seen-version', 'dita-architect-syntax-theme',
      'dita-architect-theme', 'dita-architect-workbench', 'ditaSplitWidth', 'ditaWordWrap',
    ]);
    expect(ALL_LEGACY).not.toContain('dita-architect-connected-map');
  });
});

describe('defaults', () => {
  it('a fresh install: Dark/Material, the default layout, word wrap off, the XML split not opened on load, the sync hint shown', () => {
    expect(defaultSettings()).toEqual({
      version: 1,
      workbench: defaultLayout(),
      appearance: DEFAULT_APPEARANCE,
      editor: { wordWrap: false, openXmlTrayOnLoad: false, showSyncHint: true },
      lastSeenVersion: null,
    });
  });

  it('nothing stored: loadSettings returns the defaults and writes them once', () => {
    const st = memoryStorage();
    expect(loadSettings(st)).toEqual(defaultSettings());
    expect(JSON.parse(st.getItem(SETTINGS_KEY)!)).toMatchObject({ version: 1, editor: { wordWrap: false } });
  });
});

describe('A2 / ST1 — each legacy key migrates on its own', () => {
  const only = (key: string, value: string) => migrateLegacy(k => (k === key ? value : null));

  it('ditaWordWrap', () => {
    expect(only('ditaWordWrap', 'true').editor.wordWrap).toBe(true);
    expect(only('ditaWordWrap', 'false').editor.wordWrap).toBe(false);
    expect(only('ditaWordWrap', 'yes').editor.wordWrap).toBe(false);
  });

  it('ditaSplitWidth (the v1.0 left-pane percentage, ADR-017\'s rule)', () => {
    expect(only('ditaSplitWidth', '30').workbench.panels.xml.size).toBe(70);
    expect(only('ditaSplitWidth', 'garbage').workbench.panels.xml.size).toBe(defaultLayout().panels.xml.size);
  });

  it('dita-architect-theme (with geotab → navy kept)', () => {
    expect(only('dita-architect-theme', 'nord').appearance).toEqual({ activeProfileId: 'builtin:nord', profiles: [] });
    expect(only('dita-architect-theme', 'geotab').appearance.activeProfileId).toBe('builtin:navy');
    expect(only('dita-architect-theme', 'altitude').appearance).toEqual(DEFAULT_APPEARANCE);
  });

  it('dita-architect-syntax-theme (alone, on the Dark base it lands on a custom profile of that pair)', () => {
    const a = only('dita-architect-syntax-theme', 'dracula').appearance;
    expect(a.profiles.map(p => [p.name, p.base, p.syntaxTheme])).toEqual([['Dark, Dracula XML', 'dark', 'dracula']]);
    expect(a.activeProfileId).toBe(a.profiles[0].id);
    expect(only('dita-architect-syntax-theme', 'material').appearance).toEqual(DEFAULT_APPEARANCE);
  });

  it('dita-architect-last-seen-version', () => {
    expect(only('dita-architect-last-seen-version', '1.2.0').lastSeenVersion).toBe('1.2.0');
  });

  it('dita-architect-workbench (ADR-017\'s object, parsed as before)', () => {
    const l = defaultLayout();
    l.activeView = 'map';
    l.panels.xml = { open: true, size: 40 };
    l.sidePanelWidth = 320;
    expect(only('dita-architect-workbench', serializeLayout(l)).workbench).toEqual(l);
    expect(only('dita-architect-workbench', '{"v":1,"panels":').workbench).toEqual(defaultLayout());
  });

  it('dita-architect-coach-sync-hint (present = the hint was dismissed)', () => {
    expect(only('dita-architect-coach-sync-hint', 'dismissed').editor.showSyncHint).toBe(false);
    expect(migrateLegacy(() => null).editor.showSyncHint).toBe(true);
  });

  it('the two theme keys together: a pair no built-in matches becomes one custom profile, nothing visible changes', () => {
    const s = migrateLegacy(k => ({ 'dita-architect-theme': 'nord', 'dita-architect-syntax-theme': 'dracula' } as Record<string, string>)[k] ?? null);
    expect(s.appearance.profiles.map(p => [p.name, p.base, p.syntaxTheme, p.overrides])).toEqual([['Nord, Dracula XML', 'nord', 'dracula', {}]]);
  });
});

describe('A2 — the migration runs once and removes the legacy keys', () => {
  const v12 = () => memoryStorage({
    ditaWordWrap: 'true',
    ditaSplitWidth: '35',
    'dita-architect-theme': 'light',
    'dita-architect-syntax-theme': 'daylight',
    'dita-architect-last-seen-version': '1.2.0',
    'dita-architect-coach-sync-hint': 'dismissed',
    'dita-architect-connected-map': '{"uuid":"m","name":"Guide.ditamap"}',
  });

  it('builds the store from every key, writes it, and removes all seven, leaving the connected map alone', () => {
    const st = v12();
    const s = loadSettings(st);
    expect(s.editor).toEqual({ wordWrap: true, openXmlTrayOnLoad: false, showSyncHint: false });
    expect(s.appearance.activeProfileId).toBe('builtin:light');
    expect(s.workbench.panels.xml.size).toBe(65);
    expect(s.lastSeenVersion).toBe('1.2.0');
    for (const k of ALL_LEGACY) expect(st.getItem(k), k).toBeNull();
    expect(st.getItem('dita-architect-connected-map')).not.toBeNull();
    expect(parseSettings(st.getItem(SETTINGS_KEY))).toEqual(s);
  });

  it('a second load is a no-op: the store wins, and a legacy key that reappears is ignored and left alone', () => {
    const st = v12();
    const first = loadSettings(st);
    const stored = st.getItem(SETTINGS_KEY);
    st.setItem('dita-architect-theme', 'solarized');
    expect(loadSettings(st)).toEqual(first);
    expect(st.getItem(SETTINGS_KEY)).toBe(stored);
    expect(st.getItem('dita-architect-theme')).toBe('solarized');
  });

  it('a store that cannot be written keeps every legacy key, so nothing is lost; the session still gets the migrated values', () => {
    const st = v12();
    st.failWrites = true;
    const s = loadSettings(st);
    expect(s.appearance.activeProfileId).toBe('builtin:light');
    expect(st.getItem(SETTINGS_KEY)).toBeNull();
    for (const k of ALL_LEGACY.filter(k => k !== 'dita-architect-workbench')) expect(st.getItem(k), k).not.toBeNull();
  });

  it('a corrupt store is treated as absent: migrated from whatever legacy keys exist (or defaults), then overwritten', () => {
    const st = memoryStorage({ [SETTINGS_KEY]: '{"version":1,"editor":', ditaWordWrap: 'true' });
    expect(loadSettings(st).editor.wordWrap).toBe(true);
    expect(parseSettings(st.getItem(SETTINGS_KEY))?.editor.wordWrap).toBe(true);
    expect(st.getItem('ditaWordWrap')).toBeNull();
  });
});

describe('ST1 — tolerant, slice by slice, never throws', () => {
  it('a bad slice falls back to its defaults without resetting a good one', () => {
    const raw = JSON.stringify({ version: 1, editor: 'nonsense', appearance: { activeProfileId: 'builtin:nord', profiles: [] }, workbench: 7, lastSeenVersion: 3 });
    const s = parseSettings(raw)!;
    expect(s.editor).toEqual(defaultSettings().editor);
    expect(s.appearance.activeProfileId).toBe('builtin:nord');
    expect(s.workbench).toEqual(defaultLayout());
    expect(s.lastSeenVersion).toBeNull();
  });

  it('a partial editor slice keeps the fields it has', () => {
    expect(parseSettings(JSON.stringify({ version: 1, editor: { openXmlTrayOnLoad: true, wordWrap: 'x' } }))!.editor)
      .toEqual({ wordWrap: false, openXmlTrayOnLoad: true, showSyncHint: true });
  });

  it('parseSettings: null for nothing or for text that is not a settings object', () => {
    for (const raw of [null, '', 'x', '[]', '"str"', '{"editor":{}}']) expect(parseSettings(raw), String(raw)).toBeNull();
  });

  it('a localStorage that throws on access yields the defaults', () => {
    const throwing = { getItem() { throw new DOMException('blocked', 'SecurityError'); }, setItem() { throw new DOMException('blocked', 'SecurityError'); }, removeItem() {} } as unknown as Storage;
    expect(loadSettings(throwing)).toEqual(defaultSettings());
    expect(loadSettings(null)).toEqual(defaultSettings());
  });
});

describe('writing', () => {
  let st: Storage;
  beforeEach(() => { st = memoryStorage(); });

  it('updateSettings changes one slice and keeps the others, and the result is what is stored', () => {
    loadSettings(st);
    const after = updateSettings(s => ({ ...s, editor: { ...s.editor, openXmlTrayOnLoad: true } }), st);
    expect(after.editor.openXmlTrayOnLoad).toBe(true);
    expect(after.appearance).toEqual(DEFAULT_APPEARANCE);
    expect(loadSettings(st)).toEqual(after);
  });

  it('saveSettings reports a failed write instead of throwing', () => {
    const bad = memoryStorage();
    bad.failWrites = true;
    expect(saveSettings(defaultSettings(), bad)).toBe(false);
    expect(saveSettings(defaultSettings(), st)).toBe(true);
  });
});
