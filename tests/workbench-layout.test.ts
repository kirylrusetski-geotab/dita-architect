// ADR-017 W1 (and the pure halves of W3 / W7) — the workbench layout model.
//
// One versioned object holds the whole layout. Written before the hook and the
// components: these pin what a stored value may do to the app (nothing fatal),
// what the defaults are (Explorer open, 280 px, every panel closed, rail
// shown), and how each gesture changes the state.

import { describe, it, expect } from 'vitest';
import {
  defaultLayout,
  parseStoredLayout,
  serializeLayout,
  focusView,
  showView,
  setSidePanelWidth,
  togglePanel,
  setPanelSize,
  setPanelColumnWidth,
  setRailHidden,
  toggleRail,
  movePanel,
  openStackPanels,
  PANEL_IDS,
  STACK_PANEL_IDS,
  SIDE_PANEL,
  XML_SPLIT,
  PANEL_COLUMN,
  type WorkbenchLayout,
} from '../lib/workbench-layout';

describe('W1 — defaults', () => {
  it('Explorer open at 280 px, every panel closed, the XML split at 50 %, the rail shown', () => {
    const l = defaultLayout();
    expect(l.activeView).toBe('explorer');
    expect(l.sidePanelOpen).toBe(true);
    expect(l.sidePanelWidth).toBe(SIDE_PANEL.default);
    for (const id of PANEL_IDS) expect(l.panels[id].open, id).toBe(false);
    expect(l.panels.xml.size).toBe(XML_SPLIT.default);
    expect(l.panelOrder).toEqual([...STACK_PANEL_IDS]);
    expect(l.panelColumnWidth).toBe(PANEL_COLUMN.default);
    expect(l.railHidden).toBe(false);
  });

  it('the rail lists XML first, then the six metadata aspects in the mock\'s order', () => {
    expect([...PANEL_IDS]).toEqual(['xml', 'topic', 'heretto', 'prolog', 'conditions', 'links', 'ai']);
  });
});

describe('W1 — round trip', () => {
  it('a serialized layout parses back equal, every field included', () => {
    let l = defaultLayout();
    l = focusView(l, 'scm');
    l = setSidePanelWidth(l, 333);
    l = togglePanel(l, 'xml');
    l = setPanelSize(l, 'xml', 62);
    l = togglePanel(l, 'conditions');
    l = setPanelSize(l, 'conditions', 2);
    l = movePanel(l, 'links', 0);
    l = setPanelColumnWidth(l, 420);
    const back = parseStoredLayout(serializeLayout(l));
    expect(back).toEqual(l);
  });

  it('railHidden round-trips too (W7: survives a relaunch)', () => {
    const l = setRailHidden(defaultLayout(), true);
    expect(parseStoredLayout(serializeLayout(l)).railHidden).toBe(true);
  });

  it('the stored value carries a version number', () => {
    expect(JSON.parse(serializeLayout(defaultLayout())).v).toBe(1);
  });
});

describe('W1 — a corrupt or missing value never throws and falls back to the defaults', () => {
  it.each([
    ['missing', null],
    ['empty', ''],
    ['not JSON', '{nope'],
    ['a number', '42'],
    ['an array', '[1,2]'],
    ['null literal', 'null'],
    ['a string', '"explorer"'],
  ])('%s → defaults', (_label, raw) => {
    expect(parseStoredLayout(raw)).toEqual(defaultLayout());
  });

  it('wrong field types are ignored field by field', () => {
    const raw = JSON.stringify({
      v: 1, activeView: 'nope', sidePanelOpen: 'yes', sidePanelWidth: 'wide', panelColumnWidth: null, railHidden: 1,
      panels: 'none', panelOrder: 'topic',
    });
    expect(parseStoredLayout(raw)).toEqual(defaultLayout());
  });

  it('an unknown panel id in stored state is dropped, not fatal; known ones are kept', () => {
    const raw = JSON.stringify({ v: 1, panels: { metadata: { open: true, size: 1 }, topic: { open: true, size: 2 }, xml: { open: true, size: 40 } } });
    const l = parseStoredLayout(raw);
    expect(Object.keys(l.panels).sort()).toEqual([...PANEL_IDS].sort());
    expect(l.panels.topic).toEqual({ open: true, size: 2 });
    expect(l.panels.xml).toEqual({ open: true, size: 40 });
    expect((l.panels as Record<string, unknown>).metadata).toBeUndefined();
  });

  it('a panel order with unknown, duplicate or missing ids is repaired to every stack panel exactly once', () => {
    const raw = JSON.stringify({ v: 1, panelOrder: ['links', 'xml', 'bogus', 'links', 'topic'] });
    const l = parseStoredLayout(raw);
    expect(l.panelOrder.slice(0, 2)).toEqual(['links', 'topic']);
    expect([...l.panelOrder].sort()).toEqual([...STACK_PANEL_IDS].sort());
  });

  it('sizes are clamped to their ranges', () => {
    const raw = JSON.stringify({ v: 1, sidePanelWidth: 5000, panelColumnWidth: 1, panels: { xml: { open: false, size: 99 }, ai: { open: false, size: 1000 } } });
    const l = parseStoredLayout(raw);
    expect(l.sidePanelWidth).toBe(SIDE_PANEL.max);
    expect(l.panelColumnWidth).toBe(PANEL_COLUMN.min);
    expect(l.panels.xml.size).toBe(XML_SPLIT.max);
    expect(l.panels.ai.size).toBe(8);
  });

  it('a hidden rail with panels marked open is corrected: nothing is open while the rail is hidden', () => {
    const raw = JSON.stringify({ v: 1, railHidden: true, panels: { xml: { open: true, size: 50 }, topic: { open: true, size: 1 } } });
    const l = parseStoredLayout(raw);
    expect(l.railHidden).toBe(true);
    for (const id of PANEL_IDS) expect(l.panels[id].open, id).toBe(false);
  });
});

describe('W1 — the v1.0 split key migrates once', () => {
  it('ditaSplitWidth (the visual pane\'s percentage) becomes the XML split\'s percentage when no workbench value exists', () => {
    const l = parseStoredLayout(null, '35');
    expect(l.panels.xml.size).toBe(65);
    expect(l.panels.xml.open).toBe(false); // the default is closed regardless of the old width
  });

  it('is clamped and ignored when unreadable', () => {
    expect(parseStoredLayout(null, '99').panels.xml.size).toBe(XML_SPLIT.min);
    expect(parseStoredLayout(null, 'wide').panels.xml.size).toBe(XML_SPLIT.default);
  });

  it('still applies when the workbench value is corrupt (review finding 7)', () => {
    expect(parseStoredLayout('{"v":1,', '30').panels.xml.size).toBe(70);
    expect(parseStoredLayout('42', '30').panels.xml.size).toBe(70);
  });

  it('is ignored once a workbench value exists', () => {
    const l = parseStoredLayout(JSON.stringify({ v: 1, panels: { xml: { open: false, size: 44 } } }), '35');
    expect(l.panels.xml.size).toBe(44);
  });
});

describe('views', () => {
  it('focusing another view opens the side panel on it; focusing the active view collapses the panel (VS Code)', () => {
    let l = defaultLayout();
    l = focusView(l, 'search');
    expect(l.activeView).toBe('search');
    expect(l.sidePanelOpen).toBe(true);
    l = focusView(l, 'search');
    expect(l.sidePanelOpen).toBe(false);
    expect(l.activeView).toBe('search');
    l = focusView(l, 'search');
    expect(l.sidePanelOpen).toBe(true);
  });

  it('showView opens the panel on a view and never collapses it (Open from Heretto)', () => {
    let l = focusView(defaultLayout(), 'search');
    expect(showView(l, 'search')).toBe(l);                     // already showing: unchanged
    l = focusView(l, 'search');                                // the icon collapses it
    expect(l.sidePanelOpen).toBe(false);
    l = showView(l, 'search');
    expect(l).toMatchObject({ activeView: 'search', sidePanelOpen: true });
    expect(showView(defaultLayout(), 'map')).toMatchObject({ activeView: 'map', sidePanelOpen: true });
  });

  it('the side panel width is clamped to 200–480', () => {
    expect(setSidePanelWidth(defaultLayout(), 10).sidePanelWidth).toBe(SIDE_PANEL.min);
    expect(setSidePanelWidth(defaultLayout(), 9999).sidePanelWidth).toBe(SIDE_PANEL.max);
    expect(setSidePanelWidth(defaultLayout(), 300).sidePanelWidth).toBe(300);
  });
});

describe('W7 — panels, the split and the rail', () => {
  it('toggling a panel flips only that panel', () => {
    const l = togglePanel(defaultLayout(), 'topic');
    expect(l.panels.topic.open).toBe(true);
    for (const id of PANEL_IDS) if (id !== 'topic') expect(l.panels[id].open, id).toBe(false);
    expect(togglePanel(l, 'topic').panels.topic.open).toBe(false);
  });

  it('force-closing an already closed panel returns the same object (no spurious persist)', () => {
    const l = defaultLayout();
    expect(togglePanel(l, 'xml', false)).toBe(l);
  });

  it('the XML split and the stack are independent: both can be open at once', () => {
    let l = togglePanel(defaultLayout(), 'xml');
    l = togglePanel(l, 'prolog');
    expect(l.panels.xml.open).toBe(true);
    expect(openStackPanels(l)).toEqual(['prolog']);
  });

  it('the stack lists open panels in panelOrder, top to bottom', () => {
    let l = defaultLayout();
    l = togglePanel(l, 'ai');
    l = togglePanel(l, 'topic');
    l = togglePanel(l, 'links');
    expect(openStackPanels(l)).toEqual(['topic', 'links', 'ai']);
    l = movePanel(l, 'ai', 0);
    expect(openStackPanels(l)).toEqual(['ai', 'topic', 'links']);
  });

  it('dragging the XML divider below its minimum closes the split and keeps the last valid width', () => {
    let l = togglePanel(defaultLayout(), 'xml');
    l = setPanelSize(l, 'xml', 40);
    expect(l.panels.xml.size).toBe(40);
    l = setPanelSize(l, 'xml', XML_SPLIT.min - 1);
    expect(l.panels.xml.open).toBe(false);
    expect(l.panels.xml.size).toBe(40);
    // reopen restores the persisted width (W7)
    expect(togglePanel(l, 'xml').panels.xml.size).toBe(40);
  });

  it('the XML split is clamped to 20–85 %; a stack panel\'s weight to 0.25–8', () => {
    expect(setPanelSize(defaultLayout(), 'xml', 95).panels.xml.size).toBe(XML_SPLIT.max);
    expect(setPanelSize(defaultLayout(), 'heretto', 0).panels.heretto.size).toBe(0.25);
    expect(setPanelSize(defaultLayout(), 'heretto', 50).panels.heretto.size).toBe(8);
    expect(setPanelSize(defaultLayout(), 'heretto', Number.NaN)).toEqual(defaultLayout());
  });

  it('hiding the rail closes every panel and the split; showing it reopens nothing', () => {
    let l = togglePanel(togglePanel(defaultLayout(), 'xml'), 'conditions');
    l = setRailHidden(l, true);
    expect(l.railHidden).toBe(true);
    for (const id of PANEL_IDS) expect(l.panels[id].open, id).toBe(false);
    l = toggleRail(l);
    expect(l.railHidden).toBe(false);
    for (const id of PANEL_IDS) expect(l.panels[id].open, id).toBe(false);
  });

  it('⌘\\ with the rail hidden shows the rail and opens the XML split', () => {
    const hidden = setRailHidden(defaultLayout(), true);
    const l = togglePanel(hidden, 'xml');
    expect(l.railHidden).toBe(false);
    expect(l.panels.xml.open).toBe(true);
  });

  it('a panel cannot be open while the rail is hidden (opening any panel shows the rail)', () => {
    const l = togglePanel(setRailHidden(defaultLayout(), true), 'links');
    expect(l.railHidden).toBe(false);
    expect(l.panels.links.open).toBe(true);
  });

  it('the panel column width is clamped to 240–600', () => {
    expect(setPanelColumnWidth(defaultLayout(), 0).panelColumnWidth).toBe(PANEL_COLUMN.min);
    expect(setPanelColumnWidth(defaultLayout(), 9999).panelColumnWidth).toBe(PANEL_COLUMN.max);
  });

  it('reducers never mutate their input', () => {
    const l: WorkbenchLayout = defaultLayout();
    const snapshot = JSON.stringify(l);
    togglePanel(l, 'xml'); setPanelSize(l, 'xml', 30); setRailHidden(l, true); focusView(l, 'map'); movePanel(l, 'ai', 0);
    expect(JSON.stringify(l)).toBe(snapshot);
  });
});
