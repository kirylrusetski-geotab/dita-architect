// @vitest-environment jsdom
//
// BUG-45 — every load path ran the XML through formatXml before it became the
// tab's content (and so the serializer's master): the whole topic was
// re-indented, an empty element got whitespace inside it, and text changed
// (a <codeblock> lost its first-line indentation; "H<sub>2</sub>O" read
// "H 2 O"). Decision (2026-10-27, ADR-012 amendment): a topic opens exactly as
// its source has it; formatting happens only when the author asks for it.
// These drive the real entry points (the native bridge, the dev-server load
// poll, Heretto open and refresh) with a mocked fetch. Written before the fix.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Tab } from '../types/tab';
import { createTab } from '../types/tab';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import { registerNativeApiBridge } from '../lib/native-api-bridge';
import { useHerettoCms } from '../hooks/useHerettoCms';
import { useExternalLoad } from '../hooks/useExternalLoad';
import { computeProposedXml } from '../lib/xml-insert';

// One line, as Heretto stores topics, with whitespace that is content: a
// codeblock's leading indentation, an inline <sub>, an empty element, and the
// trailing newline.
const SOURCE =
  '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n' +
  '<concept id="c1"><title>Water</title><prolog><metadata><prodinfo><prodname></prodname></prodinfo></metadata></prolog>' +
  '<conbody><p>H<sub>2</sub>O is water.</p><codeblock>  indented first\n    second\n</codeblock></conbody></concept>\n';

const xmlResponse = (body: string) => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': 'application/xml; charset=utf-8' }),
  text: async () => body,
  json: async () => ({}),
});

const makeStore = (initial: Tab[]) => {
  let current = initial;
  const setTabs = vi.fn((updater: Tab[] | ((prev: Tab[]) => Tab[])) => {
    current = typeof updater === 'function' ? updater(current) : updater;
  });
  return { setTabs, tabs: () => current };
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('BUG-45 — a loaded topic keeps its source bytes', () => {
  it('POST /api/load-content (native bridge)', () => {
    Object.defineProperty(window, 'location', { value: { protocol: 'dita:' }, configurable: true });
    const store = makeStore([]);
    registerNativeApiBridge({
      getTabs: () => store.tabs(),
      getActiveTabId: () => '',
      getHerettoConnected: () => false,
      getTheme: () => 'dark',
      updateTab: vi.fn(),
      handleHerettoSave: vi.fn().mockResolvedValue(undefined),
      setTabs: store.setTabs as unknown as React.Dispatch<React.SetStateAction<Tab[]>>,
      setActiveTabId: vi.fn(),
    });
    const api = (window as unknown as { __ditaApi: { loadContent: (xml: string, fileName: string) => string } }).__ditaApi;
    const res = JSON.parse(api.loadContent(SOURCE, 'water.dita'));
    expect(res.status).toBe('loaded');
    const tab = store.tabs()[0];
    expect(tab.xmlContent).toBe(SOURCE);
    expect(tab.savedXmlRef.current).toBe(SOURCE);
  });

  it('the dev-server load queue (useExternalLoad)', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ loads: [{ xml: SOURCE, fileName: 'water.dita' }] }) })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ loads: [] }) });
    const store = makeStore([]);
    renderHook(() =>
      useExternalLoad({ createTab, setTabs: store.setTabs as unknown as React.Dispatch<React.SetStateAction<Tab[]>>, setActiveTabId: vi.fn() }),
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(2_100); });
    expect(store.tabs()).toHaveLength(1);
    expect(store.tabs()[0].xmlContent).toBe(SOURCE);
  });

  const renderCms = (tab: Tab) => {
    const store = makeStore([tab]);
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

  it('opening a topic from Heretto', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/file-uuid-1/content')) return xmlResponse(SOURCE);
      return xmlResponse('<files/>');
    });
    const start = createTab('<concept id="x"><title>T</title></concept>');
    const { result, store } = renderCms(start);
    await act(async () => {
      await result.current.handleHerettoOpen({ uuid: 'file-uuid-1', name: 'water.dita', type: 'file' });
    });
    expect(result.current.importVerification?.phase).toBe('results');
    act(() => { result.current.handleImportContinue(); });
    const opened = store.tabs().find(t => t.herettoFile?.uuid === 'file-uuid-1');
    expect(opened).toBeDefined();
    expect(opened!.xmlContent).toBe(SOURCE);
    expect(opened!.savedXmlRef.current).toBe(SOURCE);
  });

  it('an API insert-section into an unformatted (one-line) topic changes only the insertion point', () => {
    const at = SOURCE.lastIndexOf('</conbody>');
    const result = computeProposedXml(SOURCE, '<p>New.</p>');
    expect('proposedXml' in result).toBe(true);
    const proposed = (result as { proposedXml: string }).proposedXml;
    expect(proposed.startsWith(SOURCE.slice(0, at))).toBe(true);
    expect(proposed.endsWith(SOURCE.slice(at))).toBe(true);
    expect(proposed.slice(at, proposed.length - (SOURCE.length - at))).toBe('\n  <p>New.</p>\n');
  });

  it('refreshing a topic from Heretto', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/file-uuid-1/content')) return xmlResponse(SOURCE);
      return xmlResponse('<files/>');
    });
    const tab = createTab('<concept id="c1"><title>Old</title></concept>');
    tab.herettoFile = { uuid: 'file-uuid-1', name: 'water.dita', path: 'water.dita' };
    const { result, store } = renderCms(tab);
    await act(async () => { await result.current.doHerettoRefresh(tab.id, tab.herettoFile!, tab.savedXmlRef); });
    expect(store.tabs().find(t => t.id === tab.id)!.xmlContent).toBe(SOURCE);
    expect(tab.savedXmlRef.current).toBe(SOURCE);
  });
});
