// ADR-016 I1 / I2 — the macOS menu bar's two halves agree.
//
// Every bridge-backed menu item is one row of the MenuAction table in
// AppDelegate.swift; every row names a window.__ditaApi method that
// lib/native-menu-bridge.ts registers (or loadContent, ADR-007). This test
// reads the Swift source — a wiring check, grep-based by design (the plan
// says so) — and compares it with the bridge's exported method list. It also
// pins the P2-39/P2-40 shortcuts and proves none collides with an in-app
// shortcut in the cheat sheet.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MENU_BRIDGE_METHODS, MENU_SHORTCUT_CATEGORY } from '../lib/native-menu-bridge';
import { KEYBOARD_SHORTCUTS } from '../constants/keyboard-shortcuts';
import { THEME_OPTIONS } from '../components/Toolbar';
import { SYNTAX_THEME_OPTIONS } from '../components/MonacoDitaEditor';
import { DITA_TOPIC_TYPE } from '../constants/dita';

const SWIFT = readFileSync(join(__dirname, '..', 'macos', 'Sources', 'DITAArchitect', 'AppDelegate.swift'), 'utf-8');

interface SwiftRow { title: string; key: string; modifiers: string[]; method: string }

/** One MenuAction row per line, in exactly this argument order — the table is the contract. */
function parseMenuActions(src: string): SwiftRow[] {
  const re = /MenuAction\(title: "((?:[^"\\]|\\.)*)", key: "((?:[^"\\]|\\.)*)", modifiers: \[([^\]]*)\], method: "(\w+)"/g;
  const rows: SwiftRow[] = [];
  for (const m of src.matchAll(re)) {
    rows.push({
      title: m[1],
      key: m[2].replace(/\\\\/g, '\\'),
      modifiers: m[3].split(',').map(s => s.trim()).filter(Boolean),
      method: m[4],
    });
  }
  return rows;
}

const MOD_SYMBOL: Record<string, string> = { '.command': '⌘', '.shift': '⇧', '.option': '⌥', '.control': '⌃' };

/** Normalise any shortcut spelling to "MOD+⇧+…+KEY" so the two sides can be compared. */
function normalizeShortcut(s: string): string {
  const mods = new Set<string>();
  let key = s.trim();
  // Compact Mac spelling: leading modifier symbols, e.g. "⇧⌘N", "⌘\".
  while (key.length > 1 && '⌘⇧⌥⌃'.includes(key[0])) {
    mods.add(key[0] === '⌘' || key[0] === '⌃' ? 'MOD' : key[0]);
    key = key.slice(1);
  }
  // Plus-separated spelling: "Ctrl+Shift+U", "⌘+Enter", "Shift+Alt+F".
  if (key.includes('+') && key.length > 1) {
    const parts = key.split('+');
    key = parts.pop() ?? '';
    for (const p of parts) {
      const t = p.trim();
      if (t === 'Ctrl' || t === '⌘' || t === 'Cmd') mods.add('MOD');
      else if (t === 'Shift') mods.add('⇧');
      else if (t === 'Alt' || t === 'Option') mods.add('⌥');
    }
  }
  return [...mods].sort().join('+') + (mods.size ? '+' : '') + key.toUpperCase();
}

function swiftShortcut(row: SwiftRow): string {
  const mods = row.modifiers.map(m => MOD_SYMBOL[m] ?? m).join('');
  return normalizeShortcut(`${mods}${row.key}`);
}

// Methods on the bridge that are not menu items: a Swift → JS callback and a
// getter the smoke uses. Everything else must be reachable from a menu row.
const NOT_MENU_ITEMS = new Set(['exportFinished', 'getActiveTheme']);
// A menu row may also call the tab API's loader (ADR-007) — Open Local File… is
// native (NSOpenPanel) and hands the file to loadContent (ADR-016 decision 4).
const TAB_API_METHODS_A_ROW_MAY_CALL = new Set(['loadContent']);

describe('ADR-016 I1 — every menu item has both halves', () => {
  const rows = parseMenuActions(SWIFT);

  it('the Swift table parses (the regex and the table have not drifted apart)', () => {
    // P2-39 File menu: 3 new-topic items, Open, Close, Save, Replace, Export, Connect, Open from Heretto (10)
    // P2-41 app menu: What's New, Keyboard Shortcuts (2); P2-40 View: Toggle XML Pane (1) + 6 themes + 7 syntax themes
    expect(rows.length).toBeGreaterThanOrEqual(10 + 2 + 1 + 6 + 7);
    // Every MenuAction( in the file must have parsed — a row written across two
    // lines, or with its arguments reordered, would otherwise vanish silently
    // once the table grows past the minimum above (adversarial review, finding 5).
    const occurrences = (SWIFT.match(/\.action\(MenuAction\(/g) ?? []).length;
    expect(rows.length).toBe(occurrences);
    for (const row of rows) {
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.method).toMatch(/^[a-z][A-Za-z]+$/);
    }
  });

  it('newTopic rows pass a real topic type (the bridge would answer 400 otherwise)', () => {
    const types = [...SWIFT.matchAll(/method: "newTopic", args: \["type": "([^"]+)"\]/g)].map(m => m[1]);
    expect(types.length).toBe(3);
    for (const t of types) expect(DITA_TOPIC_TYPE as readonly string[]).toContain(t);
  });

  it('every method a menu row calls is registered by the menu bridge (or is the tab API loader)', () => {
    const registered = new Set<string>(MENU_BRIDGE_METHODS);
    for (const row of rows) {
      const ok = registered.has(row.method) || TAB_API_METHODS_A_ROW_MAY_CALL.has(row.method);
      expect(ok, `menu item "${row.title}" calls window.__ditaApi.${row.method}, which nothing registers`).toBe(true);
    }
  });

  it('every registered menu method is reachable from a menu row (no dead bridge surface)', () => {
    const called = new Set(rows.map(r => r.method));
    for (const method of MENU_BRIDGE_METHODS) {
      if (NOT_MENU_ITEMS.has(method)) continue;
      expect(called.has(method), `window.__ditaApi.${method} is registered but no menu item calls it`).toBe(true);
    }
  });

  it('the Theme and XML Syntax Theme submenus list exactly the app\'s theme options, in order (I4)', () => {
    const argOf = (row: SwiftRow) => {
      const m = SWIFT.match(new RegExp(`MenuAction\\(title: "${row.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^\\n]*args: \\["name": "([^"]+)"\\]`));
      return m?.[1];
    };
    const themeRows = rows.filter(r => r.method === 'setTheme').map(argOf);
    const syntaxRows = rows.filter(r => r.method === 'setXmlTheme').map(argOf);
    expect(themeRows).toEqual(THEME_OPTIONS.map(o => o.value));
    expect(syntaxRows).toEqual(SYNTAX_THEME_OPTIONS.map(o => o.value));
  });

  it('the table is the only way a menu item reaches the bridge — no per-item selector calls __ditaApi', () => {
    // Every "window.__ditaApi." in the Swift file must be the generic body built from a row
    // (runMenuAction), the About/Open panels' documented calls, or the loader.
    const direct = SWIFT.match(/window\.__ditaApi\.(\w+)/g) ?? [];
    for (const d of direct) {
      const name = d.replace('window.__ditaApi.', '');
      expect(TAB_API_METHODS_A_ROW_MAY_CALL.has(name), `AppDelegate.swift calls ${d} outside the MenuAction table`).toBe(true);
    }
  });
});

describe('ADR-016 I2 — the P2-39 / P2-40 shortcuts, and no collision with the toolbar', () => {
  const rows = parseMenuActions(SWIFT);
  const byTitle = (t: string) => rows.find(r => r.title === t);

  it.each([
    ['New Task', '⌘N'],
    ['New Concept', '⇧⌘N'],
    ['New Reference', '⌥⌘N'],
    ['Close Tab', '⌘W'],
    ['Save to Heretto', '⌘S'],
    ['Toggle XML Pane', '⌘\\'],
  ])('"%s" is %s', (title, shortcut) => {
    const row = byTitle(title);
    expect(row, `no menu row titled "${title}"`).toBeDefined();
    expect(swiftShortcut(row!)).toBe(normalizeShortcut(shortcut));
  });

  it('⌘O is Open Local File… (native NSOpenPanel → loadContent, ADR-016 decision 4)', () => {
    const row = rows.find(r => swiftShortcut(r) === normalizeShortcut('⌘O'));
    expect(row, 'no menu row bound to ⌘O').toBeDefined();
    expect(row!.title).toMatch(/^Open Local File/);
    expect(row!.method).toBe('loadContent');
  });

  it('no two menu rows share a shortcut', () => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      if (!row.key) continue;
      const sc = swiftShortcut(row);
      expect(seen.has(sc), `"${row.title}" and "${seen.get(sc)}" both use ${sc}`).toBe(false);
      seen.set(sc, row.title);
    }
  });

  it('no menu shortcut collides with an in-app shortcut in the cheat sheet', () => {
    const inApp = new Set(
      KEYBOARD_SHORTCUTS.filter(s => s.category !== MENU_SHORTCUT_CATEGORY)
        .flatMap(s => s.keys)
        .filter(k => k !== '↑ / ↓')
        .map(normalizeShortcut),
    );
    for (const row of rows) {
      if (!row.key) continue;
      const sc = swiftShortcut(row);
      expect(inApp.has(sc), `menu item "${row.title}" (${sc}) collides with an in-app shortcut`).toBe(false);
    }
  });

  it('the cheat sheet lists every menu shortcut, once, under the menu category', () => {
    const menuEntries = KEYBOARD_SHORTCUTS.filter(s => s.category === MENU_SHORTCUT_CATEGORY);
    const listed = menuEntries.flatMap(s => s.keys).map(normalizeShortcut);
    expect(new Set(listed).size).toBe(listed.length);
    for (const row of rows) {
      if (!row.key) continue;
      const sc = swiftShortcut(row);
      expect(listed.includes(sc), `menu item "${row.title}" (${sc}) is missing from the cheat sheet`).toBe(true);
    }
    // And nothing in the menu category that the menu does not actually bind.
    const bound = new Set(rows.filter(r => r.key).map(swiftShortcut));
    for (const sc of listed) {
      expect(bound.has(sc), `the cheat sheet lists ${sc} as a menu shortcut but no menu row binds it`).toBe(true);
    }
  });
});
