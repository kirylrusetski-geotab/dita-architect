/**
 * Tests for the modified Tab interface, specifically the addition
 * of the herettoReplaceTarget field for P2-1: Local API Endpoint.
 *
 * Tests that the createTab function correctly initializes the new field
 * and that the interface properly accepts the expected structure.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTab, resetTabIdCounter } from '../types/tab';
import type { Tab } from '../types/tab';

describe('Tab interface modifications for external content loading', () => {
  beforeEach(() => {
    resetTabIdCounter();
  });

  describe('herettoReplaceTarget field', () => {
    it('is initialized as null by createTab', () => {
      const tab = createTab('<task id="test"><title>Test</title></task>');

      expect(tab.herettoReplaceTarget).toBeNull();
    });

    it('accepts null assignment explicitly', () => {
      const tab = createTab('<task id="test"><title>Test</title></task>');

      tab.herettoReplaceTarget = null;

      expect(tab.herettoReplaceTarget).toBeNull();
    });

    it('accepts object with uuid field only', () => {
      const tab = createTab('<task id="test"><title>Test</title></task>');

      tab.herettoReplaceTarget = { uuid: 'test-uuid-123' };

      expect(tab.herettoReplaceTarget).toEqual({ uuid: 'test-uuid-123' });
    });

    it('accepts object with uuid, name, and path fields', () => {
      const tab = createTab('<task id="test"><title>Test</title></task>');

      tab.herettoReplaceTarget = {
        uuid: 'test-uuid-456',
        name: 'Test Document.dita',
        path: '/docs/topics/test-document.dita'
      };

      expect(tab.herettoReplaceTarget).toEqual({
        uuid: 'test-uuid-456',
        name: 'Test Document.dita',
        path: '/docs/topics/test-document.dita'
      });
    });

    it('accepts object with uuid and name but no path', () => {
      const tab = createTab('<task id="test"><title>Test</title></task>');

      tab.herettoReplaceTarget = {
        uuid: 'test-uuid-789',
        name: 'Another Document.dita'
      };

      expect(tab.herettoReplaceTarget).toEqual({
        uuid: 'test-uuid-789',
        name: 'Another Document.dita'
      });
    });

    it('accepts object with uuid and path but no name', () => {
      const tab = createTab('<task id="test"><title>Test</title></task>');

      tab.herettoReplaceTarget = {
        uuid: 'test-uuid-101112',
        path: '/docs/concepts/overview.dita'
      };

      expect(tab.herettoReplaceTarget).toEqual({
        uuid: 'test-uuid-101112',
        path: '/docs/concepts/overview.dita'
      });
    });

    it('preserves other tab properties when herettoReplaceTarget is set', () => {
      const xml = '<concept id="concept-1"><title>Test Concept</title></concept>';
      const tab = createTab(xml);

      // Verify original properties
      expect(tab.id).toBe('tab-1');
      expect(tab.xmlContent).toBe(xml);
      expect(tab.localFileName).toBeNull();
      expect(tab.herettoFile).toBeNull();

      // Set herettoReplaceTarget
      tab.herettoReplaceTarget = { uuid: 'replace-uuid' };

      // Verify other properties are unchanged
      expect(tab.id).toBe('tab-1');
      expect(tab.xmlContent).toBe(xml);
      expect(tab.localFileName).toBeNull();
      expect(tab.herettoFile).toBeNull();
      expect(tab.herettoReplaceTarget).toEqual({ uuid: 'replace-uuid' });
    });

    it('can be reset from object back to null', () => {
      const tab = createTab('<reference id="ref-1"><title>API Reference</title></reference>');

      // Set to object
      tab.herettoReplaceTarget = {
        uuid: 'uuid-to-replace',
        name: 'Original Document.dita'
      };
      expect(tab.herettoReplaceTarget).not.toBeNull();

      // Reset to null
      tab.herettoReplaceTarget = null;
      expect(tab.herettoReplaceTarget).toBeNull();
    });

    it('supports undefined assignment', () => {
      const tab = createTab('<task id="task-1"><title>Test Task</title></task>');

      // Set to undefined
      tab.herettoReplaceTarget = undefined;

      // Should remain undefined (TypeScript allows this)
      expect(tab.herettoReplaceTarget).toBeUndefined();
    });
  });

  describe('createTab function behavior with new field', () => {
    it('creates unique tab IDs regardless of herettoReplaceTarget setting', () => {
      const tab1 = createTab('<task id="t1"><title>Task 1</title></task>');
      const tab2 = createTab('<task id="t2"><title>Task 2</title></task>');

      tab1.herettoReplaceTarget = { uuid: 'uuid-1' };
      tab2.herettoReplaceTarget = { uuid: 'uuid-2' };

      expect(tab1.id).toBe('tab-1');
      expect(tab2.id).toBe('tab-2');
      expect(tab1.id).not.toBe(tab2.id);
    });

    it('maintains all existing tab properties alongside new field', () => {
      const xml = '<task id="comprehensive"><title>Comprehensive Test</title></task>';
      const tab = createTab(xml);

      // Verify all expected properties exist
      expect(tab).toHaveProperty('id');
      expect(tab).toHaveProperty('xmlContent', xml);
      expect(tab).toHaveProperty('lastUpdatedBy', 'code');
      expect(tab).toHaveProperty('savedXmlRef');
      expect(tab).toHaveProperty('herettoFile', null);
      expect(tab).toHaveProperty('herettoLastSaved', null);
      expect(tab).toHaveProperty('herettoRemoteChanged', false);
      expect(tab).toHaveProperty('herettoDirty', false);
      expect(tab).toHaveProperty('hasXmlErrors', false);
      expect(tab).toHaveProperty('xmlErrors');
      expect(tab).toHaveProperty('syncTrigger', 0);
      expect(tab).toHaveProperty('monacoApiRef');
      expect(tab).toHaveProperty('localFileName', null);
      expect(tab).toHaveProperty('documentMode', 'editing');
      expect(tab).toHaveProperty('acceptAllTrigger', 0);
      expect(tab).toHaveProperty('rejectAllTrigger', 0);
      expect(tab).toHaveProperty('trackedChangeCount', 0);
      expect(tab).toHaveProperty('herettoReplaceTarget', null);

      expect(Array.isArray(tab.xmlErrors)).toBe(true);
      expect(typeof tab.savedXmlRef).toBe('object');
      expect(typeof tab.monacoApiRef).toBe('object');
    });
  });

  describe('type safety and compatibility', () => {
    it('allows Tab objects to be assigned to variables', () => {
      const tab: Tab = createTab('<task id="type-test"><title>Type Test</title></task>');

      expect(tab.herettoReplaceTarget).toBeNull();
    });

    it('allows partial updates to herettoReplaceTarget through destructuring', () => {
      const tab = createTab('<concept id="destructure"><title>Destructure Test</title></concept>');

      const replaceTarget = { uuid: 'uuid-destructure', name: 'Original Name.dita' };
      tab.herettoReplaceTarget = { ...replaceTarget };

      expect(tab.herettoReplaceTarget).toEqual(replaceTarget);
      expect(tab.herettoReplaceTarget).not.toBe(replaceTarget); // Different object reference
    });

    it('supports functional updates that preserve the field', () => {
      const tab = createTab('<reference id="functional"><title>Functional Test</title></reference>');
      tab.herettoReplaceTarget = { uuid: 'original-uuid' };

      // Simulate functional update that preserves herettoReplaceTarget
      const updatedTab: Tab = {
        ...tab,
        xmlContent: '<reference id="functional"><title>Updated Title</title></reference>',
        lastUpdatedBy: 'editor'
      };

      expect(updatedTab.herettoReplaceTarget).toEqual({ uuid: 'original-uuid' });
      expect(updatedTab.xmlContent).toContain('Updated Title');
      expect(updatedTab.lastUpdatedBy).toBe('editor');
    });
  });

  describe('external load workflow scenarios', () => {
    it('supports the complete external load workflow', () => {
      // Step 1: Create tab with formatted XML
      const formattedXml = '<task id="workflow"><title>Workflow Test</title><taskbody><p>Content</p></taskbody></task>';
      const tab = createTab(formattedXml);

      expect(tab.herettoReplaceTarget).toBeNull();
      expect(tab.localFileName).toBeNull();

      // Step 2: Set fileName from external load
      tab.localFileName = 'workflow-test.dita';

      // Step 3: Set Heretto target if provided
      tab.herettoReplaceTarget = { uuid: 'target-doc-uuid' };

      // Verify final state
      expect(tab.localFileName).toBe('workflow-test.dita');
      expect(tab.herettoReplaceTarget).toEqual({ uuid: 'target-doc-uuid' });
      expect(tab.xmlContent).toBe(formattedXml);
    });

    it('works correctly when only uuid is provided (minimal Heretto target)', () => {
      const tab = createTab('<concept id="minimal"><title>Minimal Target</title></concept>');

      tab.herettoReplaceTarget = { uuid: 'minimal-uuid' };

      expect(tab.herettoReplaceTarget).toEqual({ uuid: 'minimal-uuid' });
      expect(tab.herettoReplaceTarget?.name).toBeUndefined();
      expect(tab.herettoReplaceTarget?.path).toBeUndefined();
    });

    it('maintains separation from herettoFile field', () => {
      const tab = createTab('<task id="separation"><title>Separation Test</title></task>');

      // These should remain independent
      tab.herettoReplaceTarget = { uuid: 'replace-target' };
      // herettoFile would be set by different functionality

      expect(tab.herettoReplaceTarget).toEqual({ uuid: 'replace-target' });
      expect(tab.herettoFile).toBeNull();

      // They serve different purposes and should not interfere
      expect(tab.herettoReplaceTarget).not.toBe(tab.herettoFile);
    });
  });
});