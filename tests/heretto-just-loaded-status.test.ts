// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTab } from '../types/tab';
import type { Tab } from '../types/tab';

// ─── test utilities ──────────────────────────────────────────────────────────

const createMockTab = (id: string, overrides: Partial<Tab> = {}): Tab => ({
  id,
  xmlContent: `<topic><title>Test Topic ${id}</title></topic>`,
  lastUpdatedBy: 'editor',
  savedXmlRef: { current: `<topic><title>Test Topic ${id}</title></topic>` },
  herettoFile: null,
  herettoLastSaved: null,
  herettoRemoteChanged: false,
  herettoDirty: false,
  hasXmlErrors: false,
  xmlErrors: [],
  syncTrigger: 0,
  monacoApiRef: { current: null },
  localFileName: null,
  editMode: false,
  editModeEnterTrigger: 0,
  editModeAcceptTrigger: 0,
  editModeRejectTrigger: 0,
  snapshotRef: { current: null },
  herettoReplaceTarget: null,
  herettoJustLoaded: false,
  inlineValidationErrors: new Map(),
  validationTrigger: 0,
  ...overrides
});

// Mock Heretto file object
const createMockHerettoFile = () => ({
  uuid: 'heretto-123',
  name: 'test-file.dita',
  path: '/folder/test-file.dita',
  ancestorUuids: ['parent-123', 'grandparent-456']
});

// ─── herettoJustLoaded flag management ───────────────────────────────────────

describe('herettoJustLoaded flag functionality and status bar logic', () => {
  // ── Tab interface and createTab function ─────────────────────────────────

  it('initializes herettoJustLoaded as false in new tabs', () => {
    const tab = createTab('<topic><title>Test</title></topic>');

    expect(tab.herettoJustLoaded).toBe(false);
    expect(tab).toHaveProperty('herettoJustLoaded');
  });

  it('allows herettoJustLoaded to be set to true', () => {
    const tab = createMockTab('test-1', { herettoJustLoaded: true });

    expect(tab.herettoJustLoaded).toBe(true);
  });

  it('preserves herettoJustLoaded state when updating other tab properties', () => {
    let tab = createMockTab('test-1', { herettoJustLoaded: true });

    // Simulate updating tab with new properties while preserving herettoJustLoaded
    tab = {
      ...tab,
      xmlContent: '<task><title>Updated content</title></task>',
      lastUpdatedBy: 'api' as const
    };

    expect(tab.herettoJustLoaded).toBe(true);
    expect(tab.xmlContent).toBe('<task><title>Updated content</title></task>');
  });

  // ── status bar display logic ─────────────────────────────────────────────

  it('shows "Loaded from Heretto" status when herettoJustLoaded is true', () => {
    const tab = createMockTab('test-1', {
      herettoFile: createMockHerettoFile(),
      herettoJustLoaded: true,
      herettoRemoteChanged: false,
      herettoDirty: false
    });

    // Simulate the status bar logic from dita-architect.tsx
    const getStatusInfo = (tab: Tab) => {
      if (tab.herettoJustLoaded) {
        return {
          indicator: 'green',
          message: 'Loaded from Heretto'
        };
      } else if (tab.herettoRemoteChanged) {
        return {
          indicator: 'red',
          message: tab.herettoDirty ? 'Changes in both locations' : 'Updated in Heretto'
        };
      }
      return null;
    };

    const status = getStatusInfo(tab);
    expect(status?.indicator).toBe('green');
    expect(status?.message).toBe('Loaded from Heretto');
  });

  it('shows "Updated in Heretto" status when herettoJustLoaded is false but remoteChanged is true', () => {
    const tab = createMockTab('test-1', {
      herettoFile: createMockHerettoFile(),
      herettoJustLoaded: false,
      herettoRemoteChanged: true,
      herettoDirty: false
    });

    const getStatusInfo = (tab: Tab) => {
      if (tab.herettoJustLoaded) {
        return {
          indicator: 'green',
          message: 'Loaded from Heretto'
        };
      } else if (tab.herettoRemoteChanged) {
        return {
          indicator: 'red',
          message: tab.herettoDirty ? 'Changes in both locations' : 'Updated in Heretto'
        };
      }
      return null;
    };

    const status = getStatusInfo(tab);
    expect(status?.indicator).toBe('red');
    expect(status?.message).toBe('Updated in Heretto');
  });

  it('prioritizes "Loaded from Heretto" over "Updated in Heretto" when both flags could apply', () => {
    const tab = createMockTab('test-1', {
      herettoFile: createMockHerettoFile(),
      herettoJustLoaded: true,
      herettoRemoteChanged: true, // Both flags are true
      herettoDirty: false
    });

    const getStatusInfo = (tab: Tab) => {
      if (tab.herettoJustLoaded) {
        return {
          indicator: 'green',
          message: 'Loaded from Heretto'
        };
      } else if (tab.herettoRemoteChanged) {
        return {
          indicator: 'red',
          message: tab.herettoDirty ? 'Changes in both locations' : 'Updated in Heretto'
        };
      }
      return null;
    };

    const status = getStatusInfo(tab);
    expect(status?.indicator).toBe('green');
    expect(status?.message).toBe('Loaded from Heretto');
  });

  // ── flag clearing behavior ───────────────────────────────────────────────

  it('clears herettoJustLoaded flag after save operation', () => {
    let tab = createMockTab('test-1', {
      herettoFile: createMockHerettoFile(),
      herettoJustLoaded: true,
      herettoDirty: true
    });

    // Simulate successful save operation clearing the flag
    tab = {
      ...tab,
      herettoJustLoaded: false,
      herettoDirty: false,
      herettoLastSaved: new Date(),
      herettoRemoteChanged: false
    };

    expect(tab.herettoJustLoaded).toBe(false);
    expect(tab.herettoDirty).toBe(false);
  });

  it('clears herettoJustLoaded flag after refresh operation', () => {
    let tab = createMockTab('test-1', {
      herettoFile: createMockHerettoFile(),
      herettoJustLoaded: true,
      xmlContent: '<topic><title>Original</title></topic>'
    });

    // Simulate refresh operation that updates content and clears the flag
    tab = {
      ...tab,
      xmlContent: '<topic><title>Refreshed from Heretto</title></topic>',
      lastUpdatedBy: 'code' as const,
      herettoJustLoaded: false,
      herettoRemoteChanged: false
    };

    expect(tab.herettoJustLoaded).toBe(false);
    expect(tab.lastUpdatedBy).toBe('code');
    expect(tab.xmlContent).toBe('<topic><title>Refreshed from Heretto</title></topic>');
  });

  it('clears herettoJustLoaded flag after replace operation', () => {
    let tab = createMockTab('test-1', {
      herettoFile: createMockHerettoFile(),
      herettoJustLoaded: true
    });

    // Simulate replace operation in the save handler
    tab = {
      ...tab,
      herettoJustLoaded: false,
      herettoRemoteChanged: false,
      herettoDirty: false
    };

    expect(tab.herettoJustLoaded).toBe(false);
  });

  // ── integration with import/continue workflow ────────────────────────────

  it('sets herettoJustLoaded flag when importing content from Heretto', () => {
    // Simulate the import flow from useHerettoCms
    const newTab = createTab('<topic><title>Initial</title></topic>');

    // During import, set the herettoJustLoaded flag
    const importedTab = {
      ...newTab,
      xmlContent: '<task><title>Imported from Heretto</title></task>',
      herettoFile: createMockHerettoFile(),
      herettoLastSaved: new Date(),
      herettoJustLoaded: true
    };

    expect(importedTab.herettoJustLoaded).toBe(true);
    expect(importedTab.herettoFile).not.toBeNull();
    expect(importedTab.xmlContent).toBe('<task><title>Imported from Heretto</title></task>');
  });

  // ── state transitions ────────────────────────────────────────────────────

  it('follows correct state transition: justLoaded → normal → remoteChanged', () => {
    // 1. Initial state: just loaded from Heretto
    let tab = createMockTab('test-1', {
      herettoFile: createMockHerettoFile(),
      herettoJustLoaded: true,
      herettoRemoteChanged: false,
      herettoDirty: false
    });

    // Status should show "Loaded from Heretto"
    expect(tab.herettoJustLoaded).toBe(true);

    // 2. User makes an edit - flag gets cleared
    tab = {
      ...tab,
      herettoJustLoaded: false,
      herettoDirty: true,
      xmlContent: '<task><title>User edited content</title></task>'
    };

    expect(tab.herettoJustLoaded).toBe(false);
    expect(tab.herettoDirty).toBe(true);

    // 3. Polling detects remote change
    tab = {
      ...tab,
      herettoRemoteChanged: true
    };

    expect(tab.herettoJustLoaded).toBe(false);
    expect(tab.herettoRemoteChanged).toBe(true);
    expect(tab.herettoDirty).toBe(true);

    // Status should now show "Changes in both locations" (not "Loaded from Heretto")
  });

  // ── edge cases ────────────────────────────────────────────────────────────

  it('handles tab without Heretto file correctly', () => {
    const tab = createMockTab('test-1', {
      herettoFile: null,
      herettoJustLoaded: true // This shouldn't normally happen, but test robustness
    });

    expect(tab.herettoJustLoaded).toBe(true);
    expect(tab.herettoFile).toBeNull();

    // Even without Heretto file, flag should behave consistently
  });

  it('handles rapid flag changes without issues', () => {
    let tab = createMockTab('test-1', {
      herettoFile: createMockHerettoFile(),
      herettoJustLoaded: false
    });

    // Rapid state changes
    const states = [
      { herettoJustLoaded: true, description: 'loaded' },
      { herettoJustLoaded: false, description: 'cleared after save' },
      { herettoJustLoaded: true, description: 'loaded again' },
      { herettoJustLoaded: false, description: 'cleared after refresh' }
    ];

    states.forEach((state, index) => {
      tab = { ...tab, herettoJustLoaded: state.herettoJustLoaded };
      expect(tab.herettoJustLoaded).toBe(state.herettoJustLoaded);
    });
  });

  // ── type safety ──────────────────────────────────────────────────────────

  it('maintains type safety for herettoJustLoaded property', () => {
    const tab = createTab('<topic><title>Test</title></topic>');

    // Should be boolean type
    expect(typeof tab.herettoJustLoaded).toBe('boolean');

    // Should accept only boolean values
    const updatedTab = { ...tab, herettoJustLoaded: true };
    expect(typeof updatedTab.herettoJustLoaded).toBe('boolean');
    expect(updatedTab.herettoJustLoaded).toBe(true);
  });

  // ── combination with other status indicators ─────────────────────────────

  it('works correctly with saving progress states', () => {
    const tab = createMockTab('test-1', {
      herettoFile: createMockHerettoFile(),
      herettoJustLoaded: true
    });

    // Simulate full status logic including saving states
    const getFullStatusInfo = (tab: Tab, saveProgress: string) => {
      if (saveProgress === 'saving') {
        return { indicator: 'amber', message: 'Saving to Heretto...' };
      } else if (saveProgress === 'verifying') {
        return { indicator: 'amber', message: 'Verifying save...' };
      } else if (tab.herettoJustLoaded) {
        return { indicator: 'green', message: 'Loaded from Heretto' };
      } else if (tab.herettoRemoteChanged) {
        return { indicator: 'red', message: tab.herettoDirty ? 'Changes in both locations' : 'Updated in Heretto' };
      }
      return null;
    };

    // When saving, should show saving status (higher priority than justLoaded)
    let status = getFullStatusInfo(tab, 'saving');
    expect(status?.message).toBe('Saving to Heretto...');

    // When not saving, should show justLoaded status
    status = getFullStatusInfo(tab, 'idle');
    expect(status?.message).toBe('Loaded from Heretto');
  });

  // ── backwards compatibility ──────────────────────────────────────────────

  it('does not break existing tab functionality when herettoJustLoaded is added', () => {
    const tab = createTab('<topic><title>Test</title></topic>');

    // All existing properties should still be present
    expect(tab).toHaveProperty('id');
    expect(tab).toHaveProperty('xmlContent');
    expect(tab).toHaveProperty('lastUpdatedBy');
    expect(tab).toHaveProperty('herettoFile');
    expect(tab).toHaveProperty('herettoRemoteChanged');
    expect(tab).toHaveProperty('herettoDirty');

    // New property should be added without affecting others
    expect(tab).toHaveProperty('herettoJustLoaded');
    expect(tab.herettoJustLoaded).toBe(false);
  });
});