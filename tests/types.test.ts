import { describe, it, expect, beforeEach } from 'vitest';
import { createTab, resetTabIdCounter } from '../types/tab';

// Reset the module-level counter before each test so tests are independent.
beforeEach(() => {
  resetTabIdCounter();
});

describe('createTab', () => {
  it('produces an id with the tab- prefix', () => {
    const tab = createTab('<task/>');
    expect(tab.id).toMatch(/^tab-\d+$/);
  });

  it('assigns id tab-1 to the first tab after a reset', () => {
    const tab = createTab('<task/>');
    expect(tab.id).toBe('tab-1');
  });

  it('increments the id for each subsequent call', () => {
    const a = createTab('<task/>');
    const b = createTab('<concept/>');
    const c = createTab('<reference/>');
    expect(a.id).toBe('tab-1');
    expect(b.id).toBe('tab-2');
    expect(c.id).toBe('tab-3');
  });

  it('each call produces a unique id', () => {
    const ids = Array.from({ length: 10 }, () => createTab('<task/>').id);
    const unique = new Set(ids);
    expect(unique.size).toBe(10);
  });

  it('stores the provided xml in xmlContent', () => {
    const xml = '<task id="t1"><title>Hello</title></task>';
    const tab = createTab(xml);
    expect(tab.xmlContent).toBe(xml);
  });

  it('sets lastUpdatedBy to "code" by default', () => {
    const tab = createTab('<task/>');
    expect(tab.lastUpdatedBy).toBe('code');
  });

  it('initialises savedXmlRef.current to the provided xml', () => {
    const xml = '<task/>';
    const tab = createTab(xml);
    expect(tab.savedXmlRef.current).toBe(xml);
  });

  it('sets herettoFile to null by default', () => {
    const tab = createTab('<task/>');
    expect(tab.herettoFile).toBeNull();
  });

  it('sets herettoLastSaved to null by default', () => {
    const tab = createTab('<task/>');
    expect(tab.herettoLastSaved).toBeNull();
  });

  it('sets herettoRemoteChanged to false by default', () => {
    const tab = createTab('<task/>');
    expect(tab.herettoRemoteChanged).toBe(false);
  });

  it('sets herettoDirty to false by default', () => {
    const tab = createTab('<task/>');
    expect(tab.herettoDirty).toBe(false);
  });

  it('sets hasXmlErrors to false by default', () => {
    const tab = createTab('<task/>');
    expect(tab.hasXmlErrors).toBe(false);
  });

  it('sets xmlErrors to an empty array by default', () => {
    const tab = createTab('<task/>');
    expect(tab.xmlErrors).toEqual([]);
  });

  it('sets syncTrigger to 0 by default', () => {
    const tab = createTab('<task/>');
    expect(tab.syncTrigger).toBe(0);
  });

  it('sets monacoApiRef.current to null by default', () => {
    const tab = createTab('<task/>');
    expect(tab.monacoApiRef.current).toBeNull();
  });

  it('sets localFileName to null by default', () => {
    const tab = createTab('<task/>');
    expect(tab.localFileName).toBeNull();
  });

  it("sets documentMode to 'editing' by default", () => {
    const tab = createTab('<task/>');
    expect(tab.documentMode).toBe('editing');
  });

  it('sets acceptAllTrigger to 0 by default', () => {
    const tab = createTab('<task/>');
    expect(tab.acceptAllTrigger).toBe(0);
  });

  it('sets rejectAllTrigger to 0 by default', () => {
    const tab = createTab('<task/>');
    expect(tab.rejectAllTrigger).toBe(0);
  });

  it('sets trackedChangeCount to 0 by default', () => {
    const tab = createTab('<task/>');
    expect(tab.trackedChangeCount).toBe(0);
  });

  it('sets pendingReview to null by default (snapshotRef retired by FR-046)', () => {
    const tab = createTab('<task/>');
    expect(tab.pendingReview).toBeNull();
  });

  it('creates independent savedXmlRef objects per tab', () => {
    const a = createTab('<task/>');
    const b = createTab('<concept/>');
    // Mutating one ref must not affect the other
    a.savedXmlRef.current = 'mutated';
    expect(b.savedXmlRef.current).toBe('<concept/>');
  });

  it('creates independent monacoApiRef objects per tab', () => {
    const a = createTab('<task/>');
    const b = createTab('<concept/>');
    (a.monacoApiRef as { current: unknown }).current = { revealLine: () => {} };
    expect(b.monacoApiRef.current).toBeNull();
  });

  it('creates independent xmlErrors arrays per tab', () => {
    const a = createTab('<task/>');
    const b = createTab('<concept/>');
    a.xmlErrors.push({ line: 1, column: 1, message: 'err', severity: 'error' });
    expect(b.xmlErrors).toHaveLength(0);
  });

  it('works correctly with an empty string as xml', () => {
    const tab = createTab('');
    expect(tab.xmlContent).toBe('');
    expect(tab.savedXmlRef.current).toBe('');
  });
});
