// BUG-24 — regression tests for the three BUG-16 Heretto fixes that shipped in
// v0.9.1 without coverage:
//   1. Save verification strips Heretto-injected `class` attributes from both
//      sides before comparing, so a round-trip through Heretto is "identical".
//   2. The remote-change poll and Refresh ignore any non-XML response
//      (an HTML error page must never overwrite a tab or its savedXmlRef).
//   3. useExternalLoad reschedules after a non-OK poll instead of stopping.
//
// These drive the real hooks with `renderHook` and a mocked `fetch`; nothing
// here re-implements the logic under test.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Tab } from '../types/tab';
import { createTab } from '../types/tab';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import { toast } from 'sonner';
import { useHerettoCms } from '../hooks/useHerettoCms';
import { useExternalLoad } from '../hooks/useExternalLoad';

type FetchMock = ReturnType<typeof vi.fn>;

const xmlResponse = (body: string, ok = true, status = 200) => ({
  ok,
  status,
  headers: new Headers({ 'content-type': 'application/xml; charset=utf-8' }),
  text: async () => body,
  json: async () => ({}),
});

const htmlResponse = (body = '<!DOCTYPE html><html><body>Sign in</body></html>') => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
  text: async () => body,
  json: async () => ({}),
});

const AUTHORED = '<concept id="c1"><title>Journeys</title><conbody><p>Hello <uicontrol>Save</uicontrol>.</p></conbody></concept>';
// What Heretto hands back: the same document with its class stamping applied.
const HERETTO_STAMPED =
  '<concept id="c1" class="- topic/topic concept/concept "><title class="- topic/title ">Journeys</title>' +
  '<conbody class="- topic/body  concept/conbody "><p class="- topic/p ">Hello <uicontrol class="+ topic/ph ui-d/uicontrol ">Save</uicontrol>.</p></conbody></concept>';

const makeHerettoTab = (xml: string): Tab => {
  const tab = createTab(xml);
  tab.herettoFile = { uuid: 'file-uuid-1', name: 'journeys.dita', path: 'Guides/journeys.dita' };
  tab.savedXmlRef.current = xml;
  return tab;
};

/** Applies every functional updater passed to a mocked setTabs so tests can read the resulting tabs. */
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
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.warning).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('BUG-16 fix 1 — save verification ignores Heretto class stamping', () => {
  it('reports "Saved and verified" when the only difference is injected class attributes', async () => {
    const tab = makeHerettoTab(AUTHORED);
    // Call order inside handleHerettoSave: mount probe (GET root) may run first,
    // then PUT content, then GET verify. Route by method + URL rather than by order.
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return xmlResponse('');
      if (String(url).endsWith('/file-uuid-1/content')) return xmlResponse(HERETTO_STAMPED);
      return xmlResponse('<files/>');
    });

    const { result, store } = renderCms(tab);
    await act(async () => { await result.current.handleHerettoSave(tab.id); });

    expect(toast.success).toHaveBeenCalledWith('Saved and verified journeys.dita');
    expect(toast.warning).not.toHaveBeenCalled();
    // savedXmlRef is advanced to what we sent, and the dirty flags clear.
    expect(tab.savedXmlRef.current).toBe(AUTHORED);
    const saved = store.tabs().find(t => t.id === tab.id)!;
    expect(saved.herettoDirty).toBe(false);
    expect(saved.herettoRemoteChanged).toBe(false);
  });

  it('still warns when the remote content genuinely differs (not just class attributes)', async () => {
    const tab = makeHerettoTab(AUTHORED);
    const reallyDifferent = HERETTO_STAMPED.replace('Journeys', 'Trips');
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return xmlResponse('');
      if (String(url).endsWith('/file-uuid-1/content')) return xmlResponse(reallyDifferent);
      return xmlResponse('<files/>');
    });

    const { result } = renderCms(tab);
    await act(async () => { await result.current.handleHerettoSave(tab.id); });

    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('remote content differs'));
  });

  it('fails verification loudly when Heretto answers the verify GET with HTML', async () => {
    const tab = makeHerettoTab(AUTHORED);
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return xmlResponse('');
      if (String(url).endsWith('/file-uuid-1/content')) return htmlResponse();
      return xmlResponse('<files/>');
    });

    const { result } = renderCms(tab);
    let caught: unknown = null;
    await act(async () => {
      try { await result.current.handleHerettoSave(tab.id); } catch (e) { caught = e; }
    });

    // The save API (lib/native-api-bridge.ts saveTab) relies on this rethrow to report failure.
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain('non-XML response during verification');
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('non-XML response during verification'));
    expect(toast.success).not.toHaveBeenCalled();
    // Nothing was recorded as saved.
    expect(tab.savedXmlRef.current).toBe(AUTHORED);
  });
});

describe('BUG-16 fix 2 — non-XML responses never overwrite a tab', () => {
  it('Refresh rejects an HTML body and leaves xmlContent and savedXmlRef untouched', async () => {
    const tab = makeHerettoTab(AUTHORED);
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/file-uuid-1/content')) return htmlResponse();
      return xmlResponse('<files/>');
    });

    const { result, store } = renderCms(tab);
    await act(async () => {
      await result.current.doHerettoRefresh(tab.id, tab.herettoFile!, tab.savedXmlRef);
    });

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('non-XML response'));
    expect(tab.savedXmlRef.current).toBe(AUTHORED);
    expect(store.tabs().find(t => t.id === tab.id)!.xmlContent).toBe(AUTHORED);
  });

  it('Refresh applies a genuine XML body (control case)', async () => {
    const tab = makeHerettoTab(AUTHORED);
    const updated = AUTHORED.replace('Hello', 'Updated');
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/file-uuid-1/content')) return xmlResponse(updated);
      return xmlResponse('<files/>');
    });

    const { result, store } = renderCms(tab);
    await act(async () => {
      await result.current.doHerettoRefresh(tab.id, tab.herettoFile!, tab.savedXmlRef);
    });

    expect(toast.success).toHaveBeenCalledWith('Refreshed journeys.dita from Heretto');
    expect(store.tabs().find(t => t.id === tab.id)!.xmlContent).toContain('Updated');
    expect(tab.savedXmlRef.current).toContain('Updated');
  });

  it('the remote-change poll treats an HTML body as a failed check, not as changed content', async () => {
    vi.useFakeTimers();
    const tab = makeHerettoTab(AUTHORED);
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/file-uuid-1/content')) return htmlResponse();
      return xmlResponse('<files/>');
    });

    const { store } = renderCms(tab);
    // Base interval is 30 s with ±25 % jitter; 60 s guarantees at least one poll.
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

    const polled = fetchMock.mock.calls.some(([url]) => String(url).endsWith('/file-uuid-1/content'));
    expect(polled).toBe(true);
    expect(store.tabs().find(t => t.id === tab.id)!.herettoRemoteChanged).toBe(false);
  });

  it('the remote-change poll flags a genuine remote difference (control case)', async () => {
    vi.useFakeTimers();
    const tab = makeHerettoTab(AUTHORED);
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/file-uuid-1/content')) return xmlResponse(AUTHORED.replace('Hello', 'Changed'));
      return xmlResponse('<files/>');
    });

    const { store } = renderCms(tab);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

    expect(store.tabs().find(t => t.id === tab.id)!.herettoRemoteChanged).toBe(true);
  });
});

describe('FR-062 slice 2 — the content root folder comes from configuration, not a constant', () => {
  const credentials = (rootUuid: string) => ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => '',
    json: async () => ({ host: 'example.heretto.com', rootUuid, email: 'a@example.com', hasCredentials: true }),
  });

  it('probes the configured root folder and reports connected', async () => {
    const tab = createTab('<concept id="x"><title>T</title></concept>');
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url) === '/heretto-credentials') return credentials('root-from-config');
      if (String(url) === '/heretto-api/all-files/root-from-config') return xmlResponse('<folder/>');
      return { ok: false, status: 404, headers: new Headers(), text: async () => '', json: async () => ({}) };
    });

    const { result } = renderCms(tab);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(result.current.herettoRootUuid).toBe('root-from-config');
    expect(result.current.herettoConnected).toBe(true);
    expect(fetchMock.mock.calls.map(([u]) => String(u))).toContain('/heretto-api/all-files/root-from-config');
  });

  it('with no root configured it probes nothing and stays disconnected', async () => {
    const tab = createTab('<concept id="x"><title>T</title></concept>');
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url) === '/heretto-credentials') return credentials('');
      return xmlResponse('<folder/>');
    });

    const { result } = renderCms(tab);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(result.current.herettoRootUuid).toBe('');
    expect(result.current.herettoConnected).toBe(false);
    expect(fetchMock.mock.calls.some(([u]) => String(u).startsWith('/heretto-api/all-files/'))).toBe(false);
  });

  it('no hardcoded tenant root UUID remains in constants/heretto.ts', async () => {
    const mod = await import('../constants/heretto');
    expect('HERETTO_ROOT_UUID' in mod).toBe(false);
  });
});

describe('BUG-16 fix 3 — useExternalLoad keeps polling after a non-OK response', () => {
  it('reschedules after a 500 and picks up a load queued on the next poll', async () => {
    vi.useFakeTimers();
    const queued = '<concept id="q1"><title>Queued</title><conbody><p>x</p></conbody></concept>';
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ loads: [{ xml: queued, fileName: 'queued.dita' }] }) })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ loads: [] }) });

    const store = makeSetTabs([]);
    const setActiveTabId = vi.fn();
    renderHook(() =>
      useExternalLoad({
        createTab,
        setTabs: store.setTabs as unknown as React.Dispatch<React.SetStateAction<Tab[]>>,
        setActiveTabId,
      }),
    );

    // Poll 1 at t=2 s → 500. Before the fix this exited the loop permanently.
    await act(async () => { await vi.advanceTimersByTimeAsync(2_100); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.tabs()).toHaveLength(0);

    // Poll 2 at t=4 s → the queued load is delivered.
    await act(async () => { await vi.advanceTimersByTimeAsync(2_100); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(store.tabs()).toHaveLength(1);
    expect(store.tabs()[0].localFileName).toBe('queued.dita');
    expect(setActiveTabId).toHaveBeenCalledWith(store.tabs()[0].id);
  });
});
