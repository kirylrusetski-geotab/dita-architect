import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updateEditorStatus, updateTabsState, setSyncTriggerCallback, setSaveHandlerCallback } from '../lib/editor-state-bridge';
import type { Tab } from '../types/tab';

// Mock tab creation utility
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

describe('API Sync Integration', () => {
  let mockTabs: Tab[];
  let mockUpdateTab: any;
  let mockHandleHerettoSave: any;
  let syncCallbackMock: any;
  let saveCallbackMock: any;

  beforeEach(() => {
    // Reset mocks
    mockTabs = [
      createMockTab('tab-1', { xmlContent: '<topic id="test1"><title>Test 1</title></topic>' }),
      createMockTab('tab-2', {
        xmlContent: '<topic id="test2"><title>Test 2</title></topic>',
        herettoFile: { uuid: 'heretto-123', name: 'test.dita', path: '/test.dita' }
      })
    ];

    mockUpdateTab = vi.fn((tabId: string, updates: Partial<Tab>) => {
      const tabIndex = mockTabs.findIndex(t => t.id === tabId);
      if (tabIndex >= 0) {
        mockTabs[tabIndex] = { ...mockTabs[tabIndex], ...updates };
      }
    });

    mockHandleHerettoSave = vi.fn().mockResolvedValue(true);

    // Create sync callback as it would be registered in dita-architect.tsx
    syncCallbackMock = vi.fn((tabId: string, xmlContent: string) => {
      const tab = mockTabs.find(t => t.id === tabId);
      if (!tab) return false;
      mockUpdateTab(tabId, { xmlContent, lastUpdatedBy: 'api', syncTrigger: tab.syncTrigger + 1 });
      return true;
    });

    saveCallbackMock = vi.fn(async (tabId: string) => {
      const tab = mockTabs.find(t => t.id === tabId);
      if (!tab) {
        return { success: false, error: 'Tab not found' };
      }
      if (!tab.herettoFile) {
        return { success: false, error: 'Tab has no associated Heretto file' };
      }

      try {
        await mockHandleHerettoSave(tabId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error during save'
        };
      }
    });

    // Register callbacks as they would be in the main app
    setSyncTriggerCallback(syncCallbackMock);
    setSaveHandlerCallback(saveCallbackMock);
  });

  describe('API write to UI update flow', () => {
    it('should trigger Lexical re-parse after API content update', async () => {
      const tabId = 'tab-1';
      const newXml = '<topic id="updated"><title>API Updated Content</title><body><p>This was updated via API</p></body></topic>';

      // Simulate API update through the bridge
      const { updateTabContent } = await import('../lib/editor-state-bridge');
      const success = updateTabContent(tabId, newXml);

      expect(success).toBe(true);
      expect(syncCallbackMock).toHaveBeenCalledWith(tabId, newXml);
      expect(mockUpdateTab).toHaveBeenCalledWith(tabId, { xmlContent: newXml, lastUpdatedBy: 'api', syncTrigger: 1 });

      // Verify tab was updated
      const updatedTab = mockTabs.find(t => t.id === tabId);
      expect(updatedTab?.xmlContent).toBe(newXml);
      expect(updatedTab?.lastUpdatedBy).toBe('api');
    });

    it('should mark tab as updated by api source', async () => {
      const tabId = 'tab-1';
      const newXml = '<topic id="api-source"><title>API Source Test</title></topic>';

      // Simulate API update
      const { updateTabContent } = await import('../lib/editor-state-bridge');
      updateTabContent(tabId, newXml);

      // Verify the tab is marked with correct update source
      const updatedTab = mockTabs.find(t => t.id === tabId);
      expect(updatedTab?.lastUpdatedBy).toBe('api');
    });

    it('should handle complex XML content updates', async () => {
      const tabId = 'tab-1';
      const complexXml = `<topic id="complex">
        <title>Complex Content</title>
        <body>
          <p>Paragraph with <b>bold</b> and <i>italic</i> text</p>
          <ul>
            <li>List item 1</li>
            <li>List item 2</li>
          </ul>
          <table>
            <tgroup cols="2">
              <tbody>
                <row><entry>Cell 1</entry><entry>Cell 2</entry></row>
              </tbody>
            </tgroup>
          </table>
        </body>
      </topic>`;

      const { updateTabContent } = await import('../lib/editor-state-bridge');
      const success = updateTabContent(tabId, complexXml);

      expect(success).toBe(true);

      // Verify complex content is preserved
      const updatedTab = mockTabs.find(t => t.id === tabId);
      expect(updatedTab?.xmlContent).toContain('<b>bold</b>');
      expect(updatedTab?.xmlContent).toContain('<li>List item');
      expect(updatedTab?.xmlContent).toContain('<table>');
    });
  });

  describe('Save endpoint integration', () => {
    it('should handle successful Heretto save flow', async () => {
      const tabId = 'tab-2'; // This tab has Heretto file

      const { triggerTabSave } = await import('../lib/editor-state-bridge');
      const result = await triggerTabSave(tabId);

      expect(result.success).toBe(true);
      expect(saveCallbackMock).toHaveBeenCalledWith(tabId);
      expect(mockHandleHerettoSave).toHaveBeenCalledWith(tabId);
    });

    it('should propagate save errors to API response', async () => {
      const tabId = 'tab-1'; // This tab has no Heretto file

      const { triggerTabSave } = await import('../lib/editor-state-bridge');
      const result = await triggerTabSave(tabId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tab has no associated Heretto file');
    });

    it('should handle Heretto API failures', async () => {
      const tabId = 'tab-2';

      // Mock Heretto save failure
      mockHandleHerettoSave.mockRejectedValue(new Error('Network timeout'));

      const { triggerTabSave } = await import('../lib/editor-state-bridge');
      const result = await triggerTabSave(tabId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });

    it('should handle non-existent tab IDs', async () => {
      const tabId = 'non-existent';

      const { triggerTabSave } = await import('../lib/editor-state-bridge');
      const result = await triggerTabSave(tabId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tab not found');
    });
  });

  describe('Sync behavior and infinite loop prevention', () => {
    it('should not create infinite sync loops with API updates', async () => {
      const tabId = 'tab-1';
      const updates = Array.from({ length: 5 }, (_, i) =>
        `<topic id="loop-test-${i}"><title>Loop Test ${i}</title></topic>`
      );

      const { updateTabContent } = await import('../lib/editor-state-bridge');

      // Apply multiple updates rapidly
      for (const xml of updates) {
        const success = updateTabContent(tabId, xml);
        expect(success).toBe(true);
      }

      // Verify final state is stable
      const finalTab = mockTabs.find(t => t.id === tabId);
      expect(finalTab?.xmlContent).toContain('loop-test');
      expect(finalTab?.lastUpdatedBy).toBe('api');

      // Should have called sync callback for each update
      expect(syncCallbackMock).toHaveBeenCalledTimes(5);
    });

    it('should handle concurrent API updates correctly', async () => {
      const tabId = 'tab-1';
      const { updateTabContent } = await import('../lib/editor-state-bridge');

      // Simulate concurrent updates
      const promises = [
        Promise.resolve(updateTabContent(tabId, '<topic id="update1"><title>Update 1</title></topic>')),
        Promise.resolve(updateTabContent(tabId, '<topic id="update2"><title>Update 2</title></topic>')),
        Promise.resolve(updateTabContent(tabId, '<topic id="update3"><title>Update 3</title></topic>'))
      ];

      const results = await Promise.all(promises);

      // All updates should succeed
      results.forEach(result => {
        expect(result).toBe(true);
      });

      // Final state should be deterministic (last update wins)
      const finalTab = mockTabs.find(t => t.id === tabId);
      expect(finalTab?.xmlContent).toContain('Update');
    });
  });

  describe('State consistency across update sources', () => {
    it('should maintain consistent state between different update sources', async () => {
      const tabId = 'tab-1';
      const { updateTabContent } = await import('../lib/editor-state-bridge');

      // Start with editor update
      mockUpdateTab(tabId, { xmlContent: '<topic id="editor"><title>Editor Update</title></topic>', lastUpdatedBy: 'editor' });

      let tab = mockTabs.find(t => t.id === tabId);
      expect(tab?.lastUpdatedBy).toBe('editor');

      // Then code update
      mockUpdateTab(tabId, { xmlContent: '<topic id="code"><title>Code Update</title></topic>', lastUpdatedBy: 'code' });

      tab = mockTabs.find(t => t.id === tabId);
      expect(tab?.lastUpdatedBy).toBe('code');

      // Finally API update
      updateTabContent(tabId, '<topic id="api"><title>API Update</title></topic>');

      tab = mockTabs.find(t => t.id === tabId);
      expect(tab?.lastUpdatedBy).toBe('api');
      expect(tab?.xmlContent).toContain('API Update');
    });

    it('should preserve tab structure during API updates', async () => {
      const tabId = 'tab-2';
      const originalHerettoFile = mockTabs.find(t => t.id === tabId)?.herettoFile;

      const { updateTabContent } = await import('../lib/editor-state-bridge');
      updateTabContent(tabId, '<topic id="new-content"><title>New Content</title></topic>');

      const updatedTab = mockTabs.find(t => t.id === tabId);

      // Content should update but other properties should remain
      expect(updatedTab?.xmlContent).toContain('New Content');
      expect(updatedTab?.herettoFile).toEqual(originalHerettoFile);
      expect(updatedTab?.id).toBe(tabId);
    });
  });

  describe('Bridge callback registration', () => {
    it('should properly register and use sync trigger callback', async () => {
      const customCallback = vi.fn().mockReturnValue(true);
      setSyncTriggerCallback(customCallback);

      const { updateTabContent } = await import('../lib/editor-state-bridge');
      updateTabContent('tab-1', '<topic><title>Test</title></topic>');

      expect(customCallback).toHaveBeenCalledWith('tab-1', '<topic><title>Test</title></topic>');
    });

    it('should properly register and use save handler callback', async () => {
      const customSaveCallback = vi.fn().mockResolvedValue({ success: true });
      setSaveHandlerCallback(customSaveCallback);

      const { triggerTabSave } = await import('../lib/editor-state-bridge');
      const result = await triggerTabSave('tab-2');

      expect(customSaveCallback).toHaveBeenCalledWith('tab-2');
      expect(result.success).toBe(true);
    });

    it('should handle missing callbacks gracefully', async () => {
      setSyncTriggerCallback(null as any);
      setSaveHandlerCallback(null as any);

      const { updateTabContent, triggerTabSave } = await import('../lib/editor-state-bridge');

      // Should return false when callback is not available
      expect(updateTabContent('tab-1', '<topic></topic>')).toBe(false);

      // Should return error when save callback is not available
      const result = await triggerTabSave('tab-2');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Save handler not initialized');
    });
  });
});