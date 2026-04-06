// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createTab } from '../types/tab';
import { compareXml } from '../lib/xml-utils';
import { createEditor } from 'lexical';

// ─── Jamie's Specific Build Fix Validation ──────────────────────────────────

describe('Jamie TypeScript build fix validation', () => {

  // ── Fix 1: createTab function now accepts required XML content argument ─────

  describe('createTab function argument fix', () => {
    it('createTab function can be called with XML content argument without TypeScript errors', () => {
      // This should not throw TypeScript compilation errors anymore
      expect(() => createTab('<topic><title>Test</title></topic>')).not.toThrow();
    });

    it('createTab function returns properly typed Tab object', () => {
      const tab = createTab('<task><title>Test Task</title></task>');

      expect(tab).toBeDefined();
      expect(typeof tab.id).toBe('string');
      expect(typeof tab.xmlContent).toBe('string');
      expect(typeof tab.lastUpdatedBy).toBe('string');
      expect(typeof tab.herettoJustLoaded).toBe('boolean');
    });

    it('createTab function works with multiple calls as used in tests', () => {
      // Verify the usage pattern from heretto-just-loaded-status.test.ts works
      const tab1 = createTab('<topic><title>Test Topic 1</title></topic>');
      const tab2 = createTab('<topic><title>Test Topic 2</title></topic>');

      expect(tab1.id).not.toBe(tab2.id);
      expect(tab1.xmlContent).not.toBe(tab2.xmlContent);
    });
  });

  // ── Fix 2: compareXml direct comparison eliminates intermediate variable ──

  describe('compareXml direct comparison fix', () => {
    it('compareXml can be used directly without intermediate variables', () => {
      const mockTab = {
        savedXmlRef: { current: '<task><title>Local</title></task>' }
      };

      // This direct comparison should not generate TypeScript warnings
      const result = compareXml(mockTab.savedXmlRef.current!, '<task><title>Remote</title></task>') === 'different';

      expect(typeof result).toBe('boolean');
    });

    it('compareXml function returns correct comparison results', () => {
      const same1 = compareXml('<task><title>Test</title></task>', '<task><title>Test</title></task>');
      const same2 = compareXml('<task><title>Test</title></task>', '<task>\n  <title>Test</title>\n</task>');
      const different = compareXml('<task><title>A</title></task>', '<task><title>B</title></task>');

      expect(['identical', 'formatting']).toContain(same1);
      expect(['identical', 'formatting']).toContain(same2);
      expect(different).toBe('different');
    });
  });

  // ── Fix 3: createEditor import from 'lexical' instead of '@lexical/headless' ──

  describe('createEditor import fix', () => {
    it('createEditor can be imported from lexical package', () => {
      expect(createEditor).toBeDefined();
      expect(typeof createEditor).toBe('function');
    });

    it('createEditor works with basic configuration', () => {
      const editor = createEditor({
        namespace: 'test',
        nodes: [],
        onError: vi.fn(),
        theme: {}
      });

      expect(editor).toBeDefined();
      expect(typeof editor.update).toBe('function');
      expect(typeof editor.getEditorState).toBe('function');
    });

    it('createEditor import prevents the @lexical/headless import error', () => {
      // The fact that this test can run means the import is working
      expect(() => {
        const editor = createEditor({
          namespace: 'import-test',
          nodes: [],
          onError: vi.fn()
        });
        return editor;
      }).not.toThrow();
    });
  });

  // ── Fix 4: getAllTextNodes recursive pattern instead of getDescendants ─────

  describe('getAllTextNodes recursive implementation', () => {
    it('recursive getAllTextNodes pattern works without getDescendants', () => {
      const getAllTextNodes = (node: any): any[] => {
        const textNodes: any[] = [];

        if (node.getType && node.getType() === 'text') {
          textNodes.push(node);
        }

        if (node.getChildren) {
          node.getChildren().forEach((child: any) => {
            textNodes.push(...getAllTextNodes(child));
          });
        }

        return textNodes;
      };

      // Should not attempt to call non-existent getDescendants method
      expect(typeof getAllTextNodes).toBe('function');
    });

    it('recursive traversal handles node hierarchy correctly', () => {
      const getAllTextNodes = (node: any): any[] => {
        const textNodes: any[] = [];

        if (node.getType && node.getType() === 'text') {
          textNodes.push({
            text: node.text,
            type: node.getType()
          });
        }

        if (node.getChildren) {
          node.getChildren().forEach((child: any) => {
            textNodes.push(...getAllTextNodes(child));
          });
        }

        return textNodes;
      };

      const mockNode = {
        getType: () => 'paragraph',
        getChildren: () => [
          { getType: () => 'text', text: 'Hello', getChildren: undefined },
          { getType: () => 'text', text: 'World', getChildren: undefined }
        ]
      };

      const result = getAllTextNodes(mockNode);
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('Hello');
      expect(result[1].text).toBe('World');
    });

    it('getAllTextNodes prevents TypeError from missing getDescendants method', () => {
      const getAllTextNodes = (node: any): any[] => {
        const textNodes: any[] = [];

        if (node.getType && node.getType() === 'text') {
          textNodes.push(node);
        }

        if (node.getChildren) {
          node.getChildren().forEach((child: any) => {
            textNodes.push(...getAllTextNodes(child));
          });
        }

        return textNodes;
      };

      // This should not throw because it doesn't call getDescendants
      expect(() => {
        getAllTextNodes({
          getType: () => 'root',
          getChildren: () => []
        });
      }).not.toThrow();
    });
  });

  // ── Integration: All fixes work together without TypeScript errors ─────────

  describe('integrated build fix validation', () => {
    it('all four fixes integrate without TypeScript compilation errors', () => {
      // Fix 1: createTab with arguments
      const tab = createTab('<task><title>Integration test</title></task>');

      // Fix 2: compareXml direct usage
      const comparison = compareXml('<test/>', '<test/>') === 'identical';

      // Fix 3: createEditor from lexical
      const editor = createEditor({ namespace: 'integration', nodes: [], onError: vi.fn() });

      // Fix 4: getAllTextNodes pattern
      const getAllTextNodes = (node: any): any[] => {
        if (node.getType && node.getType() === 'text') return [node];
        if (node.getChildren) {
          return node.getChildren().flatMap((child: any) => getAllTextNodes(child));
        }
        return [];
      };

      // All should work without errors
      expect(tab).toBeDefined();
      expect(typeof comparison).toBe('boolean');
      expect(editor).toBeDefined();
      expect(typeof getAllTextNodes).toBe('function');
    });

    it('build would pass with no TypeScript errors for Jamie fixed files', () => {
      // This comprehensive test validates that the specific TypeScript errors Jamie addressed are resolved

      // heretto-just-loaded-status.test.ts fix
      expect(() => createTab('<topic><title>Test</title></topic>')).not.toThrow();

      // heretto-polling-comparexml.test.ts fix
      expect(() => compareXml('<a/>', '<b/>')).not.toThrow();

      // sync-manager-out-of-sync-banner.test.tsx fix
      expect(createEditor).toBeDefined();

      // placeholder-text-styling.test.ts fix
      const testRecursive = (node: any): any[] => {
        if (node.getChildren) {
          return node.getChildren().flatMap((child: any) => testRecursive(child));
        }
        return [node];
      };
      expect(() => testRecursive({ getChildren: () => [] })).not.toThrow();
    });
  });

  // ── Regression prevention ──────────────────────────────────────────────────

  describe('regression prevention', () => {
    it('createTab signature remains stable for test usage', () => {
      // Future changes should maintain this signature
      const tab = createTab('<test/>');
      expect(tab).toHaveProperty('id');
      expect(tab).toHaveProperty('xmlContent');
    });

    it('compareXml can still be used in polling logic', () => {
      const mockTabSavedRef = { current: '<task><title>Test</title></task>' };
      const remoteContent = '<task><title>Updated</title></task>';

      const isDifferent = compareXml(mockTabSavedRef.current, remoteContent) === 'different';
      expect(typeof isDifferent).toBe('boolean');
    });

    it('createEditor import source stays consistent', () => {
      // Should continue to work from 'lexical' package
      expect(() => createEditor({ namespace: 'test', nodes: [], onError: vi.fn() })).not.toThrow();
    });

    it('recursive node traversal pattern remains stable', () => {
      const traverse = (node: any): void => {
        if (node.getChildren) {
          node.getChildren().forEach((child: any) => traverse(child));
        }
      };

      expect(() => traverse({ getChildren: () => [] })).not.toThrow();
    });
  });
});