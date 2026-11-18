// @vitest-environment jsdom
//
// ADR-017 — the layout hook: W1 through a real (in-memory) localStorage,
// W3 (a staged proposal opens the XML split, once, on the rising edge), the
// legacy split-key migration, and the browser-mode key bindings that the
// native menu bar owns under dita: (decision 7).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkbenchLayout } from '../hooks/useWorkbenchLayout';
import { LAYOUT_STORAGE_KEY, LEGACY_SPLIT_KEY, defaultLayout, PANEL_IDS } from '../lib/workbench-layout';

/** tests/setup.ts stubs localStorage with a no-op; these tests need a real store. */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => { m.delete(k); },
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
  } as Storage;
}

let store: Storage;
const originalLocation = window.location;

beforeEach(() => {
  store = memoryStorage();
  Object.defineProperty(window, 'localStorage', { value: store, writable: true, configurable: true });
  Object.defineProperty(window, 'location', { value: { protocol: 'http:' }, configurable: true });
});
afterEach(() => {
  Object.defineProperty(window, 'location', { value: originalLocation, configurable: true });
});

const press = (key: string, mods: Partial<Pick<KeyboardEvent, 'metaKey' | 'altKey' | 'shiftKey' | 'ctrlKey'>> = {}) => {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods });
  window.dispatchEvent(ev);
  return ev;
};

describe('W1 — persisted as one object and restored on launch', () => {
  it('starts from the defaults when nothing is stored and writes them once', () => {
    const { result } = renderHook(() => useWorkbenchLayout({ activeReviewKey: null }));
    expect(result.current.layout).toEqual(defaultLayout());
    expect(JSON.parse(store.getItem(LAYOUT_STORAGE_KEY)!)).toMatchObject({ v: 1, activeView: 'explorer' });
  });

  it('every action persists, and a fresh hook restores the same layout', () => {
    const first = renderHook(() => useWorkbenchLayout({ activeReviewKey: null }));
    act(() => {
      first.result.current.focusView('map');
      first.result.current.setSidePanelWidth(321);
      first.result.current.togglePanel('xml');
      first.result.current.setPanelSize('xml', 70);
      first.result.current.togglePanel('links');
      first.result.current.setPanelColumnWidth(400);
    });
    const saved = first.result.current.layout;
    first.unmount();

    const second = renderHook(() => useWorkbenchLayout({ activeReviewKey: null }));
    expect(second.result.current.layout).toEqual(saved);
    expect(second.result.current.layout.activeView).toBe('map');
    expect(second.result.current.layout.sidePanelWidth).toBe(321);
    expect(second.result.current.layout.panels.xml).toEqual({ open: true, size: 70 });
    expect(second.result.current.openStackPanels).toEqual(['links']);
  });

  it('railHidden survives a relaunch and keeps every panel closed (W7)', () => {
    const first = renderHook(() => useWorkbenchLayout({ activeReviewKey: null }));
    act(() => { first.result.current.togglePanel('xml'); first.result.current.toggleRail(); });
    first.unmount();
    const second = renderHook(() => useWorkbenchLayout({ activeReviewKey: null }));
    expect(second.result.current.layout.railHidden).toBe(true);
    for (const id of PANEL_IDS) expect(second.result.current.layout.panels[id].open, id).toBe(false);
  });

  it('a corrupt stored value falls back to the defaults without throwing', () => {
    store.setItem(LAYOUT_STORAGE_KEY, '{"v":1,"panels":');
    const { result } = renderHook(() => useWorkbenchLayout({ activeReviewKey: null }));
    expect(result.current.layout).toEqual(defaultLayout());
  });

  it('migrates the v1.0 ditaSplitWidth key once and removes it', () => {
    store.setItem(LEGACY_SPLIT_KEY, '30');
    const { result } = renderHook(() => useWorkbenchLayout({ activeReviewKey: null }));
    expect(result.current.layout.panels.xml.size).toBe(70);
    expect(result.current.layout.panels.xml.open).toBe(false);
    expect(store.getItem(LEGACY_SPLIT_KEY)).toBeNull();
  });

  it('a localStorage that throws on access is survived (private window, blocked origin)', () => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('blocked', 'SecurityError'); },
      configurable: true,
    });
    const { result } = renderHook(() => useWorkbenchLayout({ activeReviewKey: null }));
    expect(result.current.layout).toEqual(defaultLayout());
    act(() => result.current.togglePanel('xml'));
    expect(result.current.layout.panels.xml.open).toBe(true);
  });
});

describe('W3 — a staged proposal is never invisible', () => {
  it('opens the XML split when the active tab gains a pending review', () => {
    const { result, rerender } = renderHook(
      ({ review }: { review: string | null }) => useWorkbenchLayout({ activeReviewKey: review }),
      { initialProps: { review: null as string | null } },
    );
    expect(result.current.layout.panels.xml.open).toBe(false);
    rerender({ review: 'tab-1' });
    expect(result.current.layout.panels.xml.open).toBe(true);
  });

  it('clearing the review leaves the split as the author left it (open stays open, closed stays closed)', () => {
    const { result, rerender } = renderHook(
      ({ review }: { review: string | null }) => useWorkbenchLayout({ activeReviewKey: review }),
      { initialProps: { review: null as string | null } },
    );
    rerender({ review: 'tab-1' });
    act(() => result.current.closePanel('xml'));          // the author closes it mid-review
    rerender({ review: null });
    expect(result.current.layout.panels.xml.open).toBe(false);
    rerender({ review: 'tab-1' });
    expect(result.current.layout.panels.xml.open).toBe(true);
    rerender({ review: null });
    expect(result.current.layout.panels.xml.open).toBe(true);
  });

  it('a review already pending at mount (switching to a tab that has one) opens the split', () => {
    // The hook's first render sees `true` with no previous value: the rule is
    // about the active tab having a review, so it must open here too.
    const { result } = renderHook(() => useWorkbenchLayout({ activeReviewKey: 'tab-1' }));
    expect(result.current.layout.panels.xml.open).toBe(true);
  });

  it('switching from one reviewing tab to another reopens the split even if the author closed it on the first (review finding 2)', () => {
    const { result, rerender } = renderHook(
      ({ review }: { review: string | null }) => useWorkbenchLayout({ activeReviewKey: review }),
      { initialProps: { review: null as string | null } },
    );
    rerender({ review: 'tab-A' });
    act(() => result.current.closePanel('xml'));
    rerender({ review: 'tab-B' });
    expect(result.current.layout.panels.xml.open).toBe(true);
    act(() => result.current.closePanel('xml'));
    rerender({ review: 'tab-B' });                              // the same review again: stays as the author left it
    expect(result.current.layout.panels.xml.open).toBe(false);
  });

  it('opens the split even while the rail is hidden (the rail comes back)', () => {
    const { result, rerender } = renderHook(
      ({ review }: { review: string | null }) => useWorkbenchLayout({ activeReviewKey: review }),
      { initialProps: { review: null as string | null } },
    );
    act(() => result.current.toggleRail());
    rerender({ review: 'tab-1' });
    expect(result.current.layout.railHidden).toBe(false);
    expect(result.current.layout.panels.xml.open).toBe(true);
  });
});

describe('decision 7 — key bindings in the browser only', () => {
  it('⌥⌘\\ also fires when Option changes the reported key (e.code is Backslash) — review finding 3', () => {
    const { result } = renderHook(() => useWorkbenchLayout({ activeReviewKey: null }));
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: '«', code: 'Backslash', metaKey: true, altKey: true, bubbles: true, cancelable: true })); });
    expect(result.current.layout.railHidden).toBe(true);
  });

  it('⌘1–⌘4 focus the views, ⌘\\ toggles the XML split, ⌥⌘\\ toggles the rail', () => {
    const { result } = renderHook(() => useWorkbenchLayout({ activeReviewKey: null }));
    act(() => { press('2', { metaKey: true }); });
    expect(result.current.layout.activeView).toBe('search');
    act(() => { press('4', { metaKey: true }); });
    expect(result.current.layout.activeView).toBe('scm');
    act(() => { press('4', { metaKey: true }); });               // active icon again: collapse
    expect(result.current.layout.sidePanelOpen).toBe(false);
    act(() => { press('\\', { metaKey: true }); });
    expect(result.current.layout.panels.xml.open).toBe(true);
    act(() => { press('\\', { metaKey: true, altKey: true }); });
    expect(result.current.layout.railHidden).toBe(true);
    expect(result.current.layout.panels.xml.open).toBe(false);
    act(() => { press('\\', { metaKey: true }); });               // rail hidden: show it and open XML
    expect(result.current.layout.railHidden).toBe(false);
    expect(result.current.layout.panels.xml.open).toBe(true);
  });

  it('a handled key is defaultPrevented; an unrelated one is not', () => {
    renderHook(() => useWorkbenchLayout({ activeReviewKey: null }));
    let ev!: KeyboardEvent;
    act(() => { ev = press('1', { metaKey: true }); });
    expect(ev.defaultPrevented).toBe(true);
    act(() => { ev = press('9', { metaKey: true }); });
    expect(ev.defaultPrevented).toBe(false);
    act(() => { ev = press('1', { metaKey: true, shiftKey: true }); });
    expect(ev.defaultPrevented).toBe(false);
  });

  it('installs nothing under dita: (the menu bar owns the key equivalents, so nothing fires twice)', () => {
    Object.defineProperty(window, 'location', { value: { protocol: 'dita:' }, configurable: true });
    const { result } = renderHook(() => useWorkbenchLayout({ activeReviewKey: null }));
    act(() => { press('\\', { metaKey: true }); press('3', { metaKey: true }); });
    expect(result.current.layout.panels.xml.open).toBe(false);
    expect(result.current.layout.activeView).toBe('explorer');
  });

  it('installKeyBindings overrides the run-mode default', () => {
    const { result } = renderHook(() => useWorkbenchLayout({ activeReviewKey: null, installKeyBindings: false }));
    act(() => { press('\\', { metaKey: true }); });
    expect(result.current.layout.panels.xml.open).toBe(false);
  });
});
