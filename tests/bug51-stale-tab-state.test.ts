// @vitest-environment jsdom
//
// BUG-51 — two tab-API calls in one tick could read stale tab state.
//
// `getTabs()` reads React state, which lags a `setTabs` call by one render.
// tests/native-api-bridge.test.ts's harness applies `setTabs` synchronously
// (it doesn't model React's actual timing), so it couldn't reproduce this —
// this harness models the real lag: `setTabs` QUEUES an updater, and nothing
// is visible through `getTabs()` until `flush()` runs (the next render).
// That is exactly the native smoke's failure: PUT answered `pending-review`,
// and an immediate `save` in the same tick answered 200 because it still saw
// the pre-PUT tabs array.

import { describe, it, expect, vi } from 'vitest';
import { registerNativeApiBridge } from '../lib/native-api-bridge';
import { createTab } from '../types/tab';
import type { Tab } from '../types/tab';

const BASE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="c1">
  <title>Original</title>
  <shortdesc>Original short description.</shortdesc>
  <conbody>
    <p>Original paragraph.</p>
  </conbody>
</concept>`;

const PROPOSED_XML = BASE_XML.replace('Original', 'AI revised');

function makeTab(overrides: Partial<Tab> = {}): Tab {
  return {
    ...createTab(BASE_XML),
    herettoFile: { uuid: 'abc', name: 'test.dita', path: '/test.dita' },
    ...overrides,
  };
}

/** Models React's actual setState timing: setTabs queues an updater; getTabs()
 *  keeps returning the last-committed array until flush() runs (the "next
 *  render"). Unlike the other test file's synchronous harness, a call made
 *  before flush() genuinely cannot see an update an earlier call just queued
 *  — which is the condition BUG-51 needs to reproduce. */
function makeAsyncHandlers(tab: Tab) {
  let committed: Tab[] = [tab];
  let queued: Array<(prev: Tab[]) => Tab[]> = [];
  const getTabs = () => committed;
  const setTabs = vi.fn((updater: ((prev: Tab[]) => Tab[]) | Tab[]) => {
    queued.push(typeof updater === 'function' ? (updater as (prev: Tab[]) => Tab[]) : () => updater);
  });
  const flush = () => {
    for (const u of queued) committed = u(committed);
    queued = [];
  };
  return {
    getTabs,
    setTabs,
    flush,
    updateTab: vi.fn(),
    getActiveTabId: () => tab.id,
    getHerettoConnected: () => false,
    getTheme: () => 'dark',
    handleHerettoSave: vi.fn().mockResolvedValue(undefined),
    setActiveTabId: vi.fn(),
  };
}

function getApi() {
  return (window as any).__ditaApi;
}

function setup(tab: Tab) {
  Object.defineProperty(window, 'location', { value: { protocol: 'dita:' }, configurable: true });
  const handlers = makeAsyncHandlers(tab);
  registerNativeApiBridge(handlers);
  return { api: getApi(), handlers };
}

describe('BUG-51: PUT then an immediate save in the same tick', () => {
  it('without the fix this would 200 on the stale pre-PUT document; with it, save sees the pending review and refuses', async () => {
    const tab = makeTab();
    const { api, handlers } = setup(tab);

    const putRaw = api.updateTabContent(tab.id, PROPOSED_XML);
    expect(JSON.parse(putRaw).status).toBe('pending-review');

    // No flush() here — the save call lands before React would have re-rendered.
    const saveRaw = await api.saveTab(tab.id);
    const saveRes = JSON.parse(saveRaw);

    expect(saveRes.success).toBe(false);
    expect(saveRes.httpStatus).toBe(400);
    expect(saveRes.error).toMatch(/pending review/);
    expect(handlers.handleHerettoSave).not.toHaveBeenCalled();
  });

  it('after a flush (the normal, non-racing case), the same sequence still refuses — no regression', async () => {
    const tab = makeTab();
    const { api, handlers } = setup(tab);

    api.updateTabContent(tab.id, PROPOSED_XML);
    handlers.flush();

    const saveRaw = await api.saveTab(tab.id);
    const saveRes = JSON.parse(saveRaw);
    expect(saveRes.success).toBe(false);
    expect(saveRes.error).toMatch(/pending review/);
  });

  it('a GET immediately after loadContent, in the same tick, sees the newly loaded tab (not just the next write)', () => {
    const tab = makeTab();
    const { api } = setup(tab);

    api.loadContent('<concept id="c2"><title>New</title><conbody/></concept>', 'new.dita');
    const listRaw = api.getTabs();
    const list = JSON.parse(listRaw);
    expect(list.tabs.map((t: { fileName: string | null }) => t.fileName)).toContain('new.dita');
  });
});

describe('BUG-51: insertSection then an immediate save in the same tick', () => {
  it('save sees the pending review from an insertSection call that has not yet committed', async () => {
    const tab = makeTab();
    const { api, handlers } = setup(tab);

    const insertRaw = api.insertSection(tab.id, '<p>Inserted paragraph.</p>');
    expect(JSON.parse(insertRaw).status).toBe('pending-review');

    const saveRaw = await api.saveTab(tab.id);
    const saveRes = JSON.parse(saveRaw);
    expect(saveRes.success).toBe(false);
    expect(saveRes.error).toMatch(/pending review/);
    expect(handlers.handleHerettoSave).not.toHaveBeenCalled();
  });
});

describe('BUG-51: two PUTs in the same tick', () => {
  it('the second PUT sees the first\'s pending review and refuses, rather than clobbering it', () => {
    const tab = makeTab();
    const { api } = setup(tab);

    const first = api.updateTabContent(tab.id, PROPOSED_XML);
    expect(JSON.parse(first).status).toBe('pending-review');

    const second = api.updateTabContent(tab.id, PROPOSED_XML.replace('AI revised', 'Second revision'));
    const secondRes = JSON.parse(second);
    expect(secondRes.success).toBe(false);
    expect(secondRes.error).toMatch(/pending review/);
  });
});
