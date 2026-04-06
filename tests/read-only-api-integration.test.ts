import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updateEditorStatus, updateTabsState, setEditorStateReference } from '../lib/editor-state-bridge';
import type { EditorState } from '../lib/editor-state-bridge';
import type { Tab } from '../types/tab';

describe('Read-only API Integration Tests', () => {
  let mockEditorState: EditorState;

  beforeEach(() => {
    mockEditorState = {
      version: '0.7.2',
      herettoConnected: false,
      tabCount: 0,
      activeTabId: '',
      theme: 'dark',
      tabs: new Map()
    };

    // Set up the bridge reference as vite.config.ts would do
    setEditorStateReference(mockEditorState);
  });

  describe('End-to-end state synchronization', () => {
    it('synchronizes editor status updates from React to API state', () => {
      // Simulate React useEffect updating editor status
      updateEditorStatus({
        herettoConnected: true,
        theme: 'light'
      });

      // Verify state was updated in the backend
      expect(mockEditorState.herettoConnected).toBe(true);
      expect(mockEditorState.theme).toBe('light');
    });

    it('synchronizes tab state updates from React to API state', () => {
      // Create mock tabs as they would exist in React state
      const mockTab1: Tab = {
        id: 'integration-tab-1',
        xmlContent: '<topic><title>Integration Test</title></topic>',
        lastUpdatedBy: 'editor',
        savedXmlRef: { current: '<topic><title>Integration Test</title></topic>' },
        herettoFile: { uuid: 'test-uuid', name: 'test.dita', path: '/test/path' },
        herettoLastSaved: null,
        herettoRemoteChanged: false,
        herettoDirty: true,
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
      };

      // Simulate React useEffect updating tabs state
      updateTabsState([mockTab1], 'integration-tab-1');

      // Verify the tab was converted and stored correctly
      expect(mockEditorState.tabCount).toBe(1);
      expect(mockEditorState.activeTabId).toBe('integration-tab-1');
      expect(mockEditorState.tabs.has('integration-tab-1')).toBe(true);

      const storedTab = mockEditorState.tabs.get('integration-tab-1');
      expect(storedTab).toBeDefined();
      expect(storedTab!.fileName).toBe('test.dita');
      expect(storedTab!.herettoFile).toEqual({
        uuid: 'test-uuid',
        name: 'test.dita',
        path: '/test/path'
      });
      expect(storedTab!.dirty).toBe(true);
      expect(storedTab!.xmlContent).toBe('<topic><title>Integration Test</title></topic>');
    });

    it('properly handles tab removal when tabs array is cleared', () => {
      // First add some tabs
      const mockTab: Tab = {
        id: 'temp-tab',
        xmlContent: '<topic><title>Temp</title></topic>',
        lastUpdatedBy: 'editor',
        savedXmlRef: { current: '<topic><title>Temp</title></topic>' },
        herettoFile: null,
        herettoLastSaved: null,
        herettoRemoteChanged: false,
        herettoDirty: false,
        hasXmlErrors: false,
        xmlErrors: [],
        syncTrigger: 0,
        monacoApiRef: { current: null },
        localFileName: 'temp.dita',
        editMode: false,
        editModeEnterTrigger: 0,
        editModeAcceptTrigger: 0,
        editModeRejectTrigger: 0,
        snapshotRef: { current: null },
        herettoReplaceTarget: null,
        herettoJustLoaded: false,
        inlineValidationErrors: new Map(),
        validationTrigger: 0,
      };

      updateTabsState([mockTab], 'temp-tab');
      expect(mockEditorState.tabs.size).toBe(1);

      // Now clear all tabs
      updateTabsState([], '');
      expect(mockEditorState.tabs.size).toBe(0);
      expect(mockEditorState.tabCount).toBe(0);
      expect(mockEditorState.activeTabId).toBe('');
    });

    it('handles XML errors correctly in tab state conversion', () => {
      const mockTab: Tab = {
        id: 'error-tab',
        xmlContent: '<topic><title>Broken XML</title>',
        lastUpdatedBy: 'editor',
        savedXmlRef: { current: '<topic><title>Fixed XML</title></topic>' },
        herettoFile: null,
        herettoLastSaved: null,
        herettoRemoteChanged: false,
        herettoDirty: false,
        hasXmlErrors: true,
        xmlErrors: [
          { line: 1, column: 34, message: 'Missing closing tag', severity: 'error' },
          { line: 2, column: 1, message: 'Unexpected end of input', severity: 'warning' }
        ],
        syncTrigger: 0,
        monacoApiRef: { current: null },
        localFileName: 'broken.dita',
        editMode: false,
        editModeEnterTrigger: 0,
        editModeAcceptTrigger: 0,
        editModeRejectTrigger: 0,
        snapshotRef: { current: null },
        herettoReplaceTarget: null,
        herettoJustLoaded: false,
        inlineValidationErrors: new Map(),
        validationTrigger: 0,
      };

      updateTabsState([mockTab], 'error-tab');

      const storedTab = mockEditorState.tabs.get('error-tab');
      expect(storedTab!.xmlErrorCount).toBe(2);
      expect(storedTab!.xmlErrors).toEqual([
        { line: 1, column: 34, message: 'Missing closing tag', severity: 'error' },
        { line: 2, column: 1, message: 'Unexpected end of input', severity: 'warning' }
      ]);
      // Should also be marked as dirty because content differs from saved
      expect(storedTab!.dirty).toBe(true);
    });

    it('determines dirty state correctly based on content changes', () => {
      const mockTabClean: Tab = {
        id: 'clean-tab',
        xmlContent: '<topic><title>Unchanged</title></topic>',
        lastUpdatedBy: 'editor',
        savedXmlRef: { current: '<topic><title>Unchanged</title></topic>' },
        herettoFile: null,
        herettoLastSaved: null,
        herettoRemoteChanged: false,
        herettoDirty: false,
        hasXmlErrors: false,
        xmlErrors: [],
        syncTrigger: 0,
        monacoApiRef: { current: null },
        localFileName: 'clean.dita',
        editMode: false,
        editModeEnterTrigger: 0,
        editModeAcceptTrigger: 0,
        editModeRejectTrigger: 0,
        snapshotRef: { current: null },
        herettoReplaceTarget: null,
        herettoJustLoaded: false,
        inlineValidationErrors: new Map(),
        validationTrigger: 0,
      };

      updateTabsState([mockTabClean], 'clean-tab');
      const cleanTab = mockEditorState.tabs.get('clean-tab');
      expect(cleanTab!.dirty).toBe(false);

      const mockTabDirty: Tab = {
        ...mockTabClean,
        id: 'dirty-tab',
        xmlContent: '<topic><title>Modified Content</title></topic>'
      };

      updateTabsState([mockTabDirty], 'dirty-tab');
      const dirtyTab = mockEditorState.tabs.get('dirty-tab');
      expect(dirtyTab!.dirty).toBe(true);
    });
  });

  describe('Data conversion and serialization', () => {
    it('strips non-serializable refs from tab state', () => {
      const mockTab: Tab = {
        id: 'ref-test',
        xmlContent: '<topic><title>Refs Test</title></topic>',
        lastUpdatedBy: 'editor',
        savedXmlRef: { current: 'some-ref-content' },
        herettoFile: null,
        herettoLastSaved: null,
        herettoRemoteChanged: false,
        herettoDirty: false,
        hasXmlErrors: false,
        xmlErrors: [],
        syncTrigger: 0,
        monacoApiRef: { current: null },
        localFileName: 'refs.dita',
        editMode: false,
        editModeEnterTrigger: 0,
        editModeAcceptTrigger: 0,
        editModeRejectTrigger: 0,
        snapshotRef: { current: null },
        herettoReplaceTarget: null,
        herettoJustLoaded: false,
        inlineValidationErrors: new Map(),
        validationTrigger: 0,
      };

      updateTabsState([mockTab], 'ref-test');
      const storedTab = mockEditorState.tabs.get('ref-test');

      // Verify the stored tab state doesn't include refs
      expect(storedTab).toBeDefined();
      expect(storedTab).not.toHaveProperty('savedXmlRef');
      expect(storedTab).not.toHaveProperty('monacoApiRef');
      expect(storedTab).not.toHaveProperty('snapshotRef');
      expect(storedTab).not.toHaveProperty('syncTrigger');
      expect(storedTab).not.toHaveProperty('editMode');

      // But should include the essential data
      expect(storedTab!.id).toBe('ref-test');
      expect(storedTab!.fileName).toBe('refs.dita');
      expect(storedTab!.xmlContent).toBe('<topic><title>Refs Test</title></topic>');
    });

    it('converts tab state to JSON-serializable format', () => {
      const mockTab: Tab = {
        id: 'serialize-test',
        xmlContent: '<topic><title>JSON Test</title></topic>',
        lastUpdatedBy: 'editor',
        savedXmlRef: { current: '<topic><title>JSON Test</title></topic>' },
        herettoFile: {
          uuid: 'json-test-uuid',
          name: 'json-test.dita',
          path: '/json/test/path'
        },
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
      };

      updateTabsState([mockTab], 'serialize-test');

      // Try to serialize the entire state as JSON
      const serialized = JSON.stringify({
        version: mockEditorState.version,
        herettoConnected: mockEditorState.herettoConnected,
        tabCount: mockEditorState.tabCount,
        activeTabId: mockEditorState.activeTabId,
        theme: mockEditorState.theme,
        tabs: Array.from(mockEditorState.tabs.values())
      });

      // Should not throw and should be valid JSON
      expect(() => JSON.parse(serialized)).not.toThrow();

      const parsed = JSON.parse(serialized);
      expect(parsed.tabs).toHaveLength(1);
      expect(parsed.tabs[0].id).toBe('serialize-test');
      expect(parsed.tabs[0].fileName).toBe('json-test.dita');
    });
  });

  describe('Edge cases and error handling', () => {
    it('handles update calls when no editor state is set', () => {
      // Create a minimal mock state to reset the reference
      const nullState = {
        version: '',
        herettoConnected: false,
        tabCount: 0,
        activeTabId: '',
        theme: 'dark',
        tabs: new Map()
      };

      // Reset to a clean state and then set to null to simulate uninitialized
      setEditorStateReference(nullState);
      setEditorStateReference(null as any);

      // These should not throw errors
      expect(() => updateEditorStatus({ herettoConnected: true, theme: 'light' })).not.toThrow();
      expect(() => updateTabsState([], '')).not.toThrow();

      // Restore state for other tests
      setEditorStateReference(mockEditorState);
    });

    it('handles rapid updates without memory leaks', () => {
      const initialTabsCount = mockEditorState.tabs.size;

      // Simulate rapid tab creation and deletion
      for (let i = 0; i < 50; i++) {
        const tab: Tab = {
          id: `rapid-${i}`,
          xmlContent: `<topic><title>Rapid ${i}</title></topic>`,
          lastUpdatedBy: 'editor',
          savedXmlRef: { current: `<topic><title>Rapid ${i}</title></topic>` },
          herettoFile: null,
          herettoLastSaved: null,
          herettoRemoteChanged: false,
          herettoDirty: false,
          hasXmlErrors: false,
          xmlErrors: [],
          syncTrigger: 0,
          monacoApiRef: { current: null },
          localFileName: `rapid-${i}.dita`,
          editMode: false,
          editModeEnterTrigger: 0,
          editModeAcceptTrigger: 0,
          editModeRejectTrigger: 0,
          snapshotRef: { current: null },
          herettoReplaceTarget: null,
          herettoJustLoaded: false,
          inlineValidationErrors: new Map(),
          validationTrigger: 0,
        };

        updateTabsState([tab], `rapid-${i}`);
      }

      // Clear all tabs
      updateTabsState([], '');

      // Should be back to initial state
      expect(mockEditorState.tabs.size).toBe(initialTabsCount);
      expect(mockEditorState.tabCount).toBe(0);
    });
  });
});