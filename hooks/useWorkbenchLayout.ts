import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LAYOUT_STORAGE_KEY,
  LEGACY_SPLIT_KEY,
  parseStoredLayout,
  serializeLayout,
  focusView as focusViewReducer,
  showView as showViewReducer,
  setSidePanelOpen as setSidePanelOpenReducer,
  setSidePanelWidth as setSidePanelWidthReducer,
  togglePanel as togglePanelReducer,
  setPanelSize as setPanelSizeReducer,
  setPanelColumnWidth as setPanelColumnWidthReducer,
  setRailHidden as setRailHiddenReducer,
  movePanel as movePanelReducer,
  openStackPanels,
  VIEW_IDS,
  type PanelId,
  type StackPanelId,
  type ViewId,
  type WorkbenchLayout,
} from '../lib/workbench-layout';
import { isNativeApp } from '../lib/native-api-object';

export interface UseWorkbenchLayoutOptions {
  /**
   * W3 (ADR-017 decision 3): the id of the active tab while it holds a pending
   * review, else null. Whenever this becomes a key the hook has not just seen
   * (a review staged on the active tab, or a switch to another tab that holds
   * one) the XML split opens itself, so a staged proposal is never invisible.
   * Going back to null changes nothing.
   */
  activeReviewKey: string | null;
  /**
   * Install `⌘1`–`⌘4`, `⌘\` and `⌥⌘\` on `window`. Defaults to "not the native
   * app": there the menu bar owns the key equivalents (ADR-017 decision 7), and
   * installing them here too would fire each one twice.
   */
  installKeyBindings?: boolean;
}

/** Reads `window.localStorage` defensively: a private window or a blocked origin throws on access. */
function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readStored(): WorkbenchLayout {
  const s = storage();
  if (!s) return parseStoredLayout(null);
  let raw: string | null = null;
  let legacy: string | null = null;
  try {
    raw = s.getItem(LAYOUT_STORAGE_KEY);
    legacy = s.getItem(LEGACY_SPLIT_KEY);
  } catch {
    // fall through to the defaults
  }
  const layout = parseStoredLayout(raw, legacy);
  // The legacy key is honoured once (when no workbench object exists) and then retired.
  if (legacy !== null) {
    try { s.removeItem(LEGACY_SPLIT_KEY); } catch { /* nothing to do */ }
  }
  return layout;
}

/**
 * ADR-017 — the one owner of the workbench's layout state. Every region reads
 * from `layout`; every gesture goes through one of the actions; the whole
 * object is persisted as one versioned value (W1).
 */
export function useWorkbenchLayout({ activeReviewKey, installKeyBindings }: UseWorkbenchLayoutOptions) {
  const [layout, setLayout] = useState<WorkbenchLayout>(readStored);

  // W1: persist every change as one object.
  useEffect(() => {
    const s = storage();
    if (!s) return;
    try { s.setItem(LAYOUT_STORAGE_KEY, serializeLayout(layout)); } catch { /* quota or blocked: the session still works */ }
  }, [layout]);

  const focusView = useCallback((view: ViewId) => setLayout(l => focusViewReducer(l, view)), []);
  const showView = useCallback((view: ViewId) => setLayout(l => showViewReducer(l, view)), []);
  const setSidePanelOpen = useCallback((open: boolean) => setLayout(l => setSidePanelOpenReducer(l, open)), []);
  const setSidePanelWidth = useCallback((px: number) => setLayout(l => setSidePanelWidthReducer(l, px)), []);
  const togglePanel = useCallback((id: PanelId, force?: boolean) => setLayout(l => togglePanelReducer(l, id, force)), []);
  const openPanel = useCallback((id: PanelId) => setLayout(l => togglePanelReducer(l, id, true)), []);
  const closePanel = useCallback((id: PanelId) => setLayout(l => togglePanelReducer(l, id, false)), []);
  const setPanelSize = useCallback((id: PanelId, size: number) => setLayout(l => setPanelSizeReducer(l, id, size)), []);
  const setPanelColumnWidth = useCallback((px: number) => setLayout(l => setPanelColumnWidthReducer(l, px)), []);
  const setRailHidden = useCallback((hidden: boolean) => setLayout(l => setRailHiddenReducer(l, hidden)), []);
  const toggleRail = useCallback(() => setLayout(l => setRailHiddenReducer(l, !l.railHidden)), []);
  const movePanel = useCallback((id: StackPanelId, index: number) => setLayout(l => movePanelReducer(l, id, index)), []);

  // W3: a staged proposal is never invisible. Fires when the reviewing tab
  // changes (null → a tab, or one reviewing tab → another), never when the
  // review clears, so a split the author closed stays closed for that review.
  const lastReviewKey = useRef<string | null>(null);
  useEffect(() => {
    if (activeReviewKey !== null && activeReviewKey !== lastReviewKey.current) openPanel('xml');
    lastReviewKey.current = activeReviewKey;
  }, [activeReviewKey, openPanel]);

  // Browser-mode key bindings (decision 7). The native app's menu bar owns these.
  const install = installKeyBindings ?? !isNativeApp();
  useEffect(() => {
    if (!install) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey || e.ctrlKey || e.defaultPrevented) return;
      if (e.key === '\\' || e.code === 'Backslash') {
        e.preventDefault();
        if (e.altKey) toggleRail(); else togglePanel('xml');
        return;
      }
      if (e.altKey || e.shiftKey) return;
      const n = Number.parseInt(e.key, 10);
      if (n >= 1 && n <= VIEW_IDS.length) {
        e.preventDefault();
        focusView(VIEW_IDS[n - 1]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [install, focusView, togglePanel, toggleRail]);

  const stack = useMemo(() => openStackPanels(layout), [layout]);

  return {
    layout,
    /** The stack's open panels, top to bottom. */
    openStackPanels: stack,
    focusView,
    showView,
    setSidePanelOpen,
    setSidePanelWidth,
    togglePanel,
    openPanel,
    closePanel,
    setPanelSize,
    setPanelColumnWidth,
    setRailHidden,
    toggleRail,
    movePanel,
  };
}

export type WorkbenchLayoutApi = ReturnType<typeof useWorkbenchLayout>;
