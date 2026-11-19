/**
 * ADR-017 — the workbench layout model (pure; the React hook is
 * `hooks/useWorkbenchLayout.ts`).
 *
 * Seven regions, one state object: title row · activity bar · side panel ·
 * editor · XML split · metadata panel column · right rail. The XML is a
 * split (a percentage of the editor-plus-XML width, like today's pane); the
 * metadata aspects are panels stacked in their own column. Both hang off the
 * same rail, both are closed by default, and no load path opens either
 * (ADR-017 decisions 1–3).
 *
 * Everything here is a plain function over `WorkbenchLayout` so the
 * invariants (W1, W3, W7) can be pinned without a DOM.
 */

export const VIEW_IDS = ['explorer', 'search', 'map', 'scm'] as const;
export type ViewId = typeof VIEW_IDS[number];

/** The right rail, top to bottom. `xml` is the split; the rest stack in the panel column. */
export const PANEL_IDS = ['xml', 'topic', 'heretto', 'prolog', 'conditions', 'links', 'ai'] as const;
export type PanelId = typeof PANEL_IDS[number];
export type StackPanelId = Exclude<PanelId, 'xml'>;
export const STACK_PANEL_IDS = PANEL_IDS.filter((p): p is StackPanelId => p !== 'xml');

export interface PanelState {
  open: boolean;
  /** `xml`: the split's percentage of the editor-plus-XML width. A stack panel: its flex weight. */
  size: number;
}

export interface WorkbenchLayout {
  activeView: ViewId;
  sidePanelOpen: boolean;
  sidePanelWidth: number;
  panels: Record<PanelId, PanelState>;
  /** The stack's order, top to bottom (every StackPanelId exactly once). */
  panelOrder: StackPanelId[];
  panelColumnWidth: number;
  railHidden: boolean;
}

// ADR-018: the layout is persisted as the settings store's `workbench` slice
// (lib/settings.ts), which also owns the one-time migration of the v1.1
// `dita-architect-workbench` key and the v1.0 `ditaSplitWidth` key.
const LAYOUT_VERSION = 1;

export const SIDE_PANEL = { min: 200, max: 480, default: 280 } as const;
export const XML_SPLIT = { min: 20, max: 85, default: 50 } as const;
export const PANEL_COLUMN = { min: 240, max: 600, default: 360 } as const;
/** A stack panel dragged below this height closes (ADR-017 decision 2). */
export const STACK_PANEL_MIN_PX = 120;

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isViewId = (v: unknown): v is ViewId => typeof v === 'string' && (VIEW_IDS as readonly string[]).includes(v);
const isPanelId = (v: unknown): v is PanelId => typeof v === 'string' && (PANEL_IDS as readonly string[]).includes(v);
const isStackPanelId = (v: unknown): v is StackPanelId => isPanelId(v) && v !== 'xml';

export function defaultLayout(): WorkbenchLayout {
  const panels = {} as Record<PanelId, PanelState>;
  for (const id of PANEL_IDS) panels[id] = { open: false, size: id === 'xml' ? XML_SPLIT.default : 1 };
  return {
    activeView: 'explorer',
    sidePanelOpen: true,
    sidePanelWidth: SIDE_PANEL.default,
    panels,
    panelOrder: [...STACK_PANEL_IDS],
    panelColumnWidth: PANEL_COLUMN.default,
    railHidden: false,
  };
}

export function serializeLayout(layout: WorkbenchLayout): string {
  return JSON.stringify({ v: LAYOUT_VERSION, ...layout });
}

/**
 * W1: a missing, corrupt or partial value falls back field by field to the
 * defaults, never throws; an unknown panel id is dropped; a panel missing from
 * the stored order is appended; sizes are clamped. `legacySplit` is the v1.0
 * `ditaSplitWidth` value (the visual pane's percentage) and is honoured only
 * when no workbench object exists yet.
 */
export function parseStoredLayout(raw: string | null | undefined, legacySplit?: string | null): WorkbenchLayout {
  const base = defaultLayout();
  const withLegacy = (): WorkbenchLayout => {
    const n = legacySplit ? Number.parseFloat(legacySplit) : NaN;
    if (isFiniteNumber(n)) base.panels.xml.size = clamp(100 - n, XML_SPLIT.min, XML_SPLIT.max);
    return base;
  };

  // No usable workbench object (missing or corrupt): the v1.0 split width still counts.
  if (raw === null || raw === undefined || raw === '') return withLegacy();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return withLegacy();
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return withLegacy();
  // Stored as `{v: 1, …}`. No other version exists yet; a v2 shape and its
  // migration belong to the settings store (ADR-018).
  const o = parsed as Record<string, unknown>;

  if (isViewId(o.activeView)) base.activeView = o.activeView;
  if (typeof o.sidePanelOpen === 'boolean') base.sidePanelOpen = o.sidePanelOpen;
  if (isFiniteNumber(o.sidePanelWidth)) base.sidePanelWidth = clamp(o.sidePanelWidth, SIDE_PANEL.min, SIDE_PANEL.max);
  if (isFiniteNumber(o.panelColumnWidth)) base.panelColumnWidth = clamp(o.panelColumnWidth, PANEL_COLUMN.min, PANEL_COLUMN.max);
  if (typeof o.railHidden === 'boolean') base.railHidden = o.railHidden;

  if (typeof o.panels === 'object' && o.panels !== null && !Array.isArray(o.panels)) {
    for (const [id, state] of Object.entries(o.panels as Record<string, unknown>)) {
      if (!isPanelId(id)) continue; // W1: unknown ids are dropped, not fatal
      if (typeof state !== 'object' || state === null) continue;
      const s = state as Record<string, unknown>;
      if (typeof s.open === 'boolean') base.panels[id].open = s.open;
      if (isFiniteNumber(s.size)) {
        base.panels[id].size = id === 'xml' ? clamp(s.size, XML_SPLIT.min, XML_SPLIT.max) : clamp(s.size, 0.25, 8);
      }
    }
  }

  if (Array.isArray(o.panelOrder)) {
    const seen = new Set<StackPanelId>();
    const order: StackPanelId[] = [];
    for (const id of o.panelOrder) {
      if (isStackPanelId(id) && !seen.has(id)) { seen.add(id); order.push(id); }
    }
    for (const id of STACK_PANEL_IDS) if (!seen.has(id)) order.push(id);
    base.panelOrder = order;
  }

  // The rail cannot be hidden with anything open (decision 2).
  if (base.railHidden) for (const id of PANEL_IDS) base.panels[id].open = false;

  return base;
}

// ---------------------------------------------------------------------------
// Reducers. Each returns a new object (or the same one when nothing changed).
// ---------------------------------------------------------------------------

/** Click the active view's icon and the side panel collapses; any other view opens it (VS Code). */
export function focusView(l: WorkbenchLayout, view: ViewId): WorkbenchLayout {
  if (l.activeView === view && l.sidePanelOpen) return { ...l, sidePanelOpen: false };
  return { ...l, activeView: view, sidePanelOpen: true };
}

/** Open the side panel on `view` without ever collapsing it (a command, not the icon's toggle). */
export function showView(l: WorkbenchLayout, view: ViewId): WorkbenchLayout {
  if (l.activeView === view && l.sidePanelOpen) return l;
  return { ...l, activeView: view, sidePanelOpen: true };
}

export function setSidePanelOpen(l: WorkbenchLayout, open: boolean): WorkbenchLayout {
  return l.sidePanelOpen === open ? l : { ...l, sidePanelOpen: open };
}

export function setSidePanelWidth(l: WorkbenchLayout, px: number): WorkbenchLayout {
  const width = clamp(px, SIDE_PANEL.min, SIDE_PANEL.max);
  return width === l.sidePanelWidth ? l : { ...l, sidePanelWidth: width };
}

/**
 * Toggle (or force) a panel. Opening anything while the rail is hidden shows the
 * rail first — `⌘\` with the rail hidden shows the rail and opens the XML split.
 */
export function togglePanel(l: WorkbenchLayout, id: PanelId, force?: boolean): WorkbenchLayout {
  const open = force ?? !l.panels[id].open;
  if (open === l.panels[id].open && !(open && l.railHidden)) return l;
  return {
    ...l,
    railHidden: open ? false : l.railHidden,
    panels: { ...l.panels, [id]: { ...l.panels[id], open } },
  };
}

/**
 * Resize a panel. The XML split's size is a percentage; dragging it below its
 * minimum closes the split and keeps the last valid size (W7). A stack panel's
 * size is a flex weight; its pixel minimum is the column's concern
 * (`STACK_PANEL_MIN_PX`), so it is only clamped here.
 */
export function setPanelSize(l: WorkbenchLayout, id: PanelId, size: number): WorkbenchLayout {
  if (!Number.isFinite(size)) return l;
  if (id === 'xml') {
    if (size < XML_SPLIT.min) return togglePanel(l, 'xml', false);
    const pct = clamp(size, XML_SPLIT.min, XML_SPLIT.max);
    if (pct === l.panels.xml.size) return l;
    return { ...l, panels: { ...l.panels, xml: { ...l.panels.xml, size: pct } } };
  }
  const weight = clamp(size, 0.25, 8);
  if (weight === l.panels[id].size) return l;
  return { ...l, panels: { ...l.panels, [id]: { ...l.panels[id], size: weight } } };
}

export function setPanelColumnWidth(l: WorkbenchLayout, px: number): WorkbenchLayout {
  const width = clamp(px, PANEL_COLUMN.min, PANEL_COLUMN.max);
  return width === l.panelColumnWidth ? l : { ...l, panelColumnWidth: width };
}

/** Hiding the rail closes everything on it; showing it reopens nothing. */
export function setRailHidden(l: WorkbenchLayout, hidden: boolean): WorkbenchLayout {
  if (hidden === l.railHidden) return l;
  if (!hidden) return { ...l, railHidden: false };
  const panels = { ...l.panels };
  for (const id of PANEL_IDS) panels[id] = { ...panels[id], open: false };
  return { ...l, railHidden: true, panels };
}

export function toggleRail(l: WorkbenchLayout): WorkbenchLayout {
  return setRailHidden(l, !l.railHidden);
}

/** Move a stack panel to `index` in the stack (dividers do not reorder; this is for a later drag-to-reorder). */
export function movePanel(l: WorkbenchLayout, id: StackPanelId, index: number): WorkbenchLayout {
  const without = l.panelOrder.filter(p => p !== id);
  const at = clamp(Math.trunc(index), 0, without.length);
  const panelOrder = [...without.slice(0, at), id, ...without.slice(at)];
  return panelOrder.every((p, i) => p === l.panelOrder[i]) ? l : { ...l, panelOrder };
}

/** The stack's open panels, top to bottom. */
export function openStackPanels(l: WorkbenchLayout): StackPanelId[] {
  return l.panelOrder.filter(id => l.panels[id].open);
}

/**
 * ADR-018 decision 10: the ids in `next` that `prev` did not have, in order. The
 * main component opens the XML split for them when Settings ▸ General ▸ "Open
 * the XML split when a topic opens" is on; no loader learns about the layout.
 */
export function addedIds(prev: ReadonlySet<string>, next: Iterable<string>): string[] {
  const out: string[] = [];
  for (const id of next) if (!prev.has(id)) out.push(id);
  return out;
}
