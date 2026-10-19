// @vitest-environment jsdom
//
// ADR-008 / FR-057 — native API bridge: updateTabContent proposes, saveTab guards,
// insertSection works in suggesting mode.
//
// The bridge registers on window.__ditaApi; we call the handlers directly via the
// registered object after registerNativeApiBridge() runs.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerNativeApiBridge } from '../lib/native-api-bridge';
import { createTab } from '../types/tab';
import type { Tab } from '../types/tab';

// ─── fixtures ────────────────────────────────────────────────────────────────

const BASE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="c1">
  <title>Original</title>
  <shortdesc>Original short description.</shortdesc>
  <conbody>
    <p>Original paragraph.</p>
  </conbody>
</concept>`;

const PROPOSED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="c1">
  <title>AI revised</title>
  <shortdesc>AI revised short description.</shortdesc>
  <conbody>
    <p>AI revised paragraph.</p>
  </conbody>
</concept>`;

// Blank skeleton — the primary workflow's base (POST /api/load-content loads this,
// then the writer switches to suggesting mode, then the AI PUTs a draft).
const BLANK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="c1">
  <title/>
  <shortdesc/>
  <conbody/>
</concept>`;

const SECTION_XML = `<p>Inserted paragraph.</p>`;

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeTab(overrides: Partial<Tab> = {}): Tab {
  return { ...createTab(BASE_XML), ...overrides };
}

function makeHandlers(tab: Tab) {
  const tabs = [tab];
  const updateTab = vi.fn((id: string, updates: Partial<Tab>) => {
    const idx = tabs.findIndex(t => t.id === id);
    if (idx !== -1) Object.assign(tabs[idx], updates);
  });
  const setTabs = vi.fn((updater: ((prev: Tab[]) => Tab[]) | Tab[]) => {
    if (typeof updater === 'function') {
      const result = updater(tabs);
      tabs.splice(0, tabs.length, ...result);
    }
  });
  return {
    tabs,
    updateTab,
    setTabs,
    getTabs: () => tabs,
    getActiveTabId: () => tab.id,
    getHerettoConnected: () => false,
    getTheme: () => 'dark',
    handleHerettoSave: vi.fn().mockResolvedValue(undefined),
    setActiveTabId: vi.fn(),
  };
}

function getApi() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).__ditaApi;
}

function setup(tab: Tab) {
  // Force dita: protocol so registerNativeApiBridge activates.
  Object.defineProperty(window, 'location', {
    value: { protocol: 'dita:' },
    configurable: true,
  });
  const handlers = makeHandlers(tab);
  registerNativeApiBridge(handlers);
  return { api: getApi(), handlers };
}

// ─── updateTabContent ─────────────────────────────────────────────────────────

describe('updateTabContent — ADR-008 / FR-057', () => {
  it('stages a pendingReview when incoming XML differs from current content', () => {
    const tab = makeTab();
    const { api, handlers } = setup(tab);

    const raw = api.updateTabContent(tab.id, PROPOSED_XML);
    const res = JSON.parse(raw);

    expect(res.success).toBe(true);
    expect(res.status).toBe('pending-review');

    // xmlContent must NOT be touched — handleReviewAccept commits it.
    expect(handlers.updateTab).not.toHaveBeenCalled();

    // pendingReview must be staged via setTabs.
    expect(handlers.setTabs).toHaveBeenCalledOnce();
    const updatedTab = handlers.tabs[0];
    expect(updatedTab.pendingReview).not.toBeNull();
    expect(updatedTab.pendingReview?.proposedXml).toBe(PROPOSED_XML);
    expect(updatedTab.pendingReview?.baseXml).toBe(BASE_XML);
    expect(updatedTab.pendingReview?.sourceLabel).toBe('AI draft');
    expect(updatedTab.xmlContent).toBe(BASE_XML); // unchanged
  });

  it('stages a review for a BLANK-SKELETON tab — the primary workflow case', () => {
    // Session log §62/§80: the writer loads a blank skeleton, switches to
    // suggesting mode, then the AI PUTs a full draft. This is the scenario
    // the first-draft isBlankDocument bypass would have silently skipped.
    const tab = makeTab({ xmlContent: BLANK_XML });
    const { api, handlers } = setup(tab);

    const raw = api.updateTabContent(tab.id, PROPOSED_XML);
    const res = JSON.parse(raw);

    expect(res.success).toBe(true);
    expect(res.status).toBe('pending-review');
    expect(handlers.tabs[0].pendingReview?.baseXml).toBe(BLANK_XML);
    expect(handlers.tabs[0].xmlContent).toBe(BLANK_XML); // unchanged
  });

  it('returns no-change when incoming XML is identical to current content', () => {
    const tab = makeTab();
    const { api, handlers } = setup(tab);

    const raw = api.updateTabContent(tab.id, BASE_XML);
    const res = JSON.parse(raw);

    expect(res.success).toBe(true);
    expect(res.status).toBe('no-change');
    expect(handlers.setTabs).not.toHaveBeenCalled();
    expect(handlers.updateTab).not.toHaveBeenCalled();
  });

  it('returns 400 when tab already has a pending review', () => {
    const existing = { proposedXml: PROPOSED_XML, baseXml: BASE_XML, sourceLabel: 'AI draft' };
    const tab = makeTab({ pendingReview: existing });
    const { api, handlers } = setup(tab);

    const raw = api.updateTabContent(tab.id, PROPOSED_XML);
    const res = JSON.parse(raw);

    expect(res.success).toBe(false);
    expect(res.httpStatus).toBe(400);
    expect(res.error).toMatch(/pending review/);
    expect(handlers.setTabs).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed XML', () => {
    const tab = makeTab();
    const { api } = setup(tab);

    const raw = api.updateTabContent(tab.id, '<broken>');
    const res = JSON.parse(raw);

    expect(res.success).toBe(false);
    expect(res.httpStatus).toBe(400);
  });

  it('returns 404 for unknown tab', () => {
    const tab = makeTab();
    const { api } = setup(tab);

    const raw = api.updateTabContent('nonexistent-id', PROPOSED_XML);
    const res = JSON.parse(raw);

    expect(res.success).toBe(false);
    expect(res.httpStatus).toBe(404);
  });
});

// ─── saveTab ─────────────────────────────────────────────────────────────────

describe('saveTab — ADR-008 pending-review guard', () => {
  it('refuses to save while a pendingReview is set', async () => {
    const existing = { proposedXml: PROPOSED_XML, baseXml: BASE_XML };
    const tab = makeTab({
      pendingReview: existing,
      herettoFile: { uuid: 'abc', name: 'test.dita', path: '/test.dita' },
    });
    const { api, handlers } = setup(tab);

    const raw = await api.saveTab(tab.id);
    const res = JSON.parse(raw);

    expect(res.success).toBe(false);
    expect(res.httpStatus).toBe(400);
    expect(res.error).toMatch(/pending review/);
    expect(handlers.handleHerettoSave).not.toHaveBeenCalled();
  });

  it('allows save when no pendingReview is set', async () => {
    const tab = makeTab({
      herettoFile: { uuid: 'abc', name: 'test.dita', path: '/test.dita' },
    });
    const { api, handlers } = setup(tab);

    const raw = await api.saveTab(tab.id);
    const res = JSON.parse(raw);

    expect(res.success).toBe(true);
    expect(handlers.handleHerettoSave).toHaveBeenCalledWith(tab.id);
  });
});

// ─── insertSection ────────────────────────────────────────────────────────────

describe('insertSection — suggesting-mode guard removed (ADR-008)', () => {
  it('stages a pendingReview while documentMode is suggesting', () => {
    const tab = makeTab({ documentMode: 'suggesting' });
    const { api, handlers } = setup(tab);

    const raw = api.insertSection(tab.id, SECTION_XML);
    const res = JSON.parse(raw);

    expect(res.success).toBe(true);
    expect(res.status).toBe('pending-review');
    // xmlContent unchanged; marks are unaffected
    expect(handlers.tabs[0].xmlContent).toBe(BASE_XML);
    expect(handlers.tabs[0].pendingReview).not.toBeNull();
  });

  it('still refuses when a pendingReview already exists, even in suggesting mode', () => {
    const existing = { proposedXml: PROPOSED_XML, baseXml: BASE_XML };
    const tab = makeTab({ documentMode: 'suggesting', pendingReview: existing });
    const { api, handlers } = setup(tab);

    const raw = api.insertSection(tab.id, SECTION_XML);
    const res = JSON.parse(raw);

    expect(res.success).toBe(false);
    expect(res.httpStatus).toBe(400);
    expect(res.error).toMatch(/pending review/);
    expect(handlers.setTabs).not.toHaveBeenCalled();
  });

  it('stages a review in editing mode as before', () => {
    const tab = makeTab({ documentMode: 'editing' });
    const { api } = setup(tab);

    const raw = api.insertSection(tab.id, SECTION_XML);
    const res = JSON.parse(raw);

    expect(res.success).toBe(true);
    expect(res.status).toBe('pending-review');
  });
});
