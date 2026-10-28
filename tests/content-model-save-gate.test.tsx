// FR-067 / ADR-014 — I3 (a blocked save/replace never touches xmlContent,
// savedXmlRef, or any dirty flag) and the Replace error contract. Drives the
// real hook with `renderHook` and a mocked `fetch`, following the pattern in
// tests/heretto-verification-guards.test.tsx; nothing here re-implements the
// validator under test.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Tab } from '../types/tab';
import { createTab } from '../types/tab';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import { useHerettoCms } from '../hooks/useHerettoCms';

type FetchMock = ReturnType<typeof vi.fn>;

const xmlResponse = (body: string, ok = true, status = 200) => ({
  ok, status,
  headers: new Headers({ 'content-type': 'application/xml; charset=utf-8' }),
  text: async () => body,
  json: async () => ({}),
});

/** True once a PUT was sent — the hook's own mount effect probes
 *  /heretto-credentials regardless of what a test exercises, so "fetch was
 *  never called at all" is the wrong check for "the write never happened". */
const putWasSent = (fetchMock: FetchMock) =>
  fetchMock.mock.calls.some((call: unknown[]) => (call[1] as RequestInit | undefined)?.method === 'PUT');

// <fig> is not a valid child of <cmd> (P2-36 I3 / ADR-014 I2).
const INVALID = '<?xml version="1.0"?>\n<task id="t"><title>T</title><taskbody><steps><step><cmd>Do this.<fig><title>F</title></fig></cmd></step></steps></taskbody></task>';
const VALID = '<?xml version="1.0"?>\n<task id="t"><title>T</title><taskbody><steps><step><cmd>Click <uicontrol>OK</uicontrol>.</cmd></step></steps></taskbody></task>';

const makeHerettoTab = (xml: string): Tab => {
  const tab = createTab(xml);
  tab.herettoFile = { uuid: 'file-uuid-1', name: 'task.dita', path: 'Guides/task.dita' };
  tab.savedXmlRef.current = xml;
  return tab;
};

const makeSetTabs = (initial: Tab[]) => {
  let current = initial;
  const setTabs = vi.fn((updater: Tab[] | ((prev: Tab[]) => Tab[])) => {
    current = typeof updater === 'function' ? updater(current) : updater;
  });
  return { setTabs, tabs: () => current };
};

const renderCms = (tab: Tab) => {
  const store = makeSetTabs([tab]);
  const hook = renderHook(() =>
    useHerettoCms({
      activeTab: tab,
      tabs: [tab],
      setTabs: store.setTabs as unknown as React.Dispatch<React.SetStateAction<Tab[]>>,
      setActiveTabId: vi.fn(),
      setConfirmModal: vi.fn(),
    }),
  );
  return { ...hook, store };
};

let fetchMock: FetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  // The hook's own mount effect probes /heretto-credentials regardless of what
  // the test is exercising; default to "not configured" so it resolves safely.
  fetchMock.mockResolvedValue({ ok: false, status: 404, headers: new Headers(), text: async () => '', json: async () => ({}) });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('I3: handleHerettoSave blocked by a content-model violation', () => {
  it('never calls fetch, and leaves xmlContent/savedXmlRef/dirty flags untouched', async () => {
    const tab = makeHerettoTab(INVALID);
    // Genuinely dirty (content differs from the last save) — not just the
    // flag flipped by hand, which the hook's own reconciling effect (dirty =
    // xmlContent !== savedXmlRef.current) would otherwise correct back to
    // false on mount, since content and savedXmlRef start out equal.
    tab.savedXmlRef.current = VALID;
    const { result, store } = renderCms(tab);

    await act(async () => { await result.current.handleHerettoSave(tab.id); });

    expect(putWasSent(fetchMock)).toBe(false);
    expect(tab.xmlContent).toBe(INVALID);
    expect(tab.savedXmlRef.current).toBe(VALID);
    const after = store.tabs().find(t => t.id === tab.id)!;
    expect(after.herettoDirty).toBe(true);
    expect(after.herettoLastSaved).toBeNull();
  });

  it('sets contentModelViolations with the element, parent, and a location', async () => {
    const tab = makeHerettoTab(INVALID);
    const { result } = renderCms(tab);

    await act(async () => { await result.current.handleHerettoSave(tab.id); });

    expect(result.current.contentModelViolations).toEqual([
      { element: 'fig', parent: 'cmd', line: expect.any(Number), column: expect.any(Number) },
    ]);
  });

  it('a valid document saves normally (control case, same tab shape)', async () => {
    const tab = makeHerettoTab(VALID);
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return xmlResponse('');
      if (String(url).endsWith('/file-uuid-1/content')) return xmlResponse(VALID);
      return xmlResponse('<files/>');
    });
    const { result } = renderCms(tab);

    await act(async () => { await result.current.handleHerettoSave(tab.id); });

    expect(putWasSent(fetchMock)).toBe(true);
    expect(result.current.contentModelViolations).toBeNull();
  });
});

describe('I3: handleHerettoReplace blocked by a content-model violation', () => {
  it('never calls fetch, returns {success:false, error}, and touches no tab state', async () => {
    const tab = makeHerettoTab(INVALID);
    const { result, store } = renderCms(tab);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.handleHerettoReplace({ uuid: 'other-uuid', name: 'other.dita', path: 'other.dita' });
    });

    expect(putWasSent(fetchMock)).toBe(false);
    expect(outcome!.success).toBe(false);
    expect(outcome!.error).toContain('<fig> is not a valid child of <cmd>');
    expect(outcome!.error).toContain('1 structural problem blocks this save');
    expect(tab.savedXmlRef.current).toBe(INVALID);
    expect(store.tabs().find(t => t.id === tab.id)!.herettoFile?.uuid).toBe('file-uuid-1'); // not replaced
  });

  it('does not open the Save modal (contentModelViolations stays null — Replace has its own error display)', async () => {
    const tab = makeHerettoTab(INVALID);
    const { result } = renderCms(tab);

    await act(async () => {
      await result.current.handleHerettoReplace({ uuid: 'other-uuid', name: 'other.dita', path: 'other.dita' });
    });

    expect(result.current.contentModelViolations).toBeNull();
  });

  it('a valid document replaces normally (control case)', async () => {
    const tab = makeHerettoTab(VALID);
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return xmlResponse('');
      if (String(url).endsWith('/other-uuid/content')) return xmlResponse(VALID);
      return xmlResponse('<files/>');
    });
    const { result } = renderCms(tab);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.handleHerettoReplace({ uuid: 'other-uuid', name: 'other.dita', path: 'other.dita' });
    });

    expect(putWasSent(fetchMock)).toBe(true);
    expect(outcome!.success).toBe(true);
  });
});
