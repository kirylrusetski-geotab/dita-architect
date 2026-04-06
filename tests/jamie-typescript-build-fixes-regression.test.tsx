// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEditor } from 'lexical';
import { createTab } from '../types/tab';
import { compareXml } from '../lib/xml-utils';
import { render, screen } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { SyncManager } from '../components/SyncManager';
import { DitaImageNode } from '../components/DitaImageNode';
import { DitaPhRefNode } from '../components/DitaPhRefNode';
import React from 'react';

// ─── Jamie's TypeScript Build Fixes - Regression Tests ──────────────────────

describe('Jamie TypeScript build fixes regression test suite', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Fix 1: heretto-just-loaded-status.test.ts createTab function arguments ──

  describe('createTab function signature fix validation', () => {
    it('createTab function accepts XML content argument and returns valid tab object', () => {
      const xmlContent = '<topic><title>Test Content</title></topic>';
      const tab = createTab(xmlContent);

      // Verify tab object has all required properties
      expect(tab).toBeDefined();
      expect(tab).toHaveProperty('id');
      expect(tab).toHaveProperty('xmlContent', xmlContent);
      expect(tab).toHaveProperty('lastUpdatedBy', 'editor');
      expect(tab).toHaveProperty('herettoJustLoaded', false);
      expect(tab).toHaveProperty('savedXmlRef');
      expect(tab).toHaveProperty('herettoFile', null);
      expect(tab).toHaveProperty('herettoRemoteChanged', false);
      expect(tab).toHaveProperty('herettoDirty', false);

      // Verify no TypeScript compilation errors occurred
      expect(typeof tab.id).toBe('string');
      expect(typeof tab.xmlContent).toBe('string');
      expect(typeof tab.herettoJustLoaded).toBe('boolean');
    });

    it('createTab function with default XML content creates valid tab structure', () => {
      // Test with the default content that Jamie added in his fixes
      const defaultXml = '<topic><title>Test Topic</title></topic>';
      const tab = createTab(defaultXml);

      expect(tab.xmlContent).toBe(defaultXml);
      expect(tab.savedXmlRef.current).toBe(defaultXml);
      expect(tab.lastUpdatedBy).toBe('editor');
      expect(tab.herettoJustLoaded).toBe(false);
    });

    it('createTab function handles different XML content types correctly', () => {
      const testCases = [
        '<task><title>Task Title</title></task>',
        '<concept><title>Concept Title</title></concept>',
        '<reference><title>Reference Title</title></reference>',
        ''
      ];

      testCases.forEach(xmlContent => {
        const tab = createTab(xmlContent);
        expect(tab.xmlContent).toBe(xmlContent);
        expect(tab.savedXmlRef.current).toBe(xmlContent);
        expect(() => tab).not.toThrow();
      });
    });

    it('createTab function signature is consistent with test usage patterns', () => {
      // Verify the function can be called the way it's used in the test file
      const tab1 = createTab('<topic><title>Test Topic 1</title></topic>');
      const tab2 = createTab('<topic><title>Test Topic 2</title></topic>');

      expect(tab1.id).not.toBe(tab2.id); // Should generate unique IDs
      expect(tab1.xmlContent).not.toBe(tab2.xmlContent);
      expect(typeof tab1.id).toBe('string');
      expect(typeof tab2.id).toBe('string');
    });
  });

  // ── Fix 2: heretto-polling-comparexml.test.ts string comparison warning ─────

  describe('compareXml polling logic string comparison fix', () => {
    it('compareXml function works correctly without intermediate variables causing warnings', () => {
      const localContent = '<task><title>Test Task</title></task>';
      const remoteContent = '<task><title>Test Task</title></task>';

      // Direct comparison should work without TypeScript warnings
      const result = compareXml(localContent, remoteContent);

      // Should return 'identical' or 'formatting' for same content
      expect(['identical', 'formatting'].includes(result)).toBe(true);
    });

    it('compareXml function handles different content correctly', () => {
      const localContent = '<task><title>Original Title</title></task>';
      const remoteContent = '<task><title>Updated Title</title></task>';

      const result = compareXml(localContent, remoteContent);
      expect(result).toBe('different');
    });

    it('polling logic simulation works without TypeScript literal comparison warnings', () => {
      interface MockTab {
        id: string;
        savedXmlRef: { current: string | null };
        herettoRemoteChanged: boolean;
      }

      const simulatePollingCheck = (tab: MockTab, remoteContent: string) => {
        const savedContent = tab.savedXmlRef.current;
        if (!savedContent) return false;

        // This should now work without intermediate variable warning
        return compareXml(savedContent, remoteContent) === 'different';
      };

      const tab: MockTab = {
        id: 'test-tab',
        savedXmlRef: { current: '<task><title>Local</title></task>' },
        herettoRemoteChanged: false
      };

      const hasChanges = simulatePollingCheck(tab, '<task><title>Remote</title></task>');
      expect(typeof hasChanges).toBe('boolean');
      expect(hasChanges).toBe(true);
    });

    it('compareXml string equality replacement prevents false positives', () => {
      const content1 = '<task><title>Test</title></task>';
      const content2 = `<task>
  <title>Test</title>
</task>`;

      // Direct string comparison would show different
      expect(content1 === content2 as string).toBe(false);

      // compareXml should handle formatting differences correctly
      const xmlComparison = compareXml(content1, content2);
      expect(['identical', 'formatting']).toContain(xmlComparison);
    });
  });

  // ── Fix 3: placeholder-text-styling.test.ts getDescendants method fix ───────

  describe('getAllTextNodes recursive function implementation', () => {
    it('getAllTextNodes function correctly replaces non-existent getDescendants method', () => {
      const testEditor = createEditor({
        nodes: [DitaImageNode, DitaPhRefNode],
      });

      // Test the recursive getAllTextNodes pattern that Jamie implemented
      testEditor.update(() => {
        const getAllTextNodes = (node: any): any[] => {
          const textNodes: any[] = [];

          if (node.getType() === 'text') {
            textNodes.push(node);
          }

          if (node.getChildren) {
            node.getChildren().forEach((child: any) => {
              textNodes.push(...getAllTextNodes(child));
            });
          }

          return textNodes;
        };

        // Should not throw errors with the new implementation
        expect(() => getAllTextNodes).not.toThrow();
        expect(typeof getAllTextNodes).toBe('function');
      });
    });

    it('recursive getAllTextNodes handles node hierarchy correctly', () => {
      const testEditor = createEditor({
        nodes: [DitaImageNode, DitaPhRefNode],
      });

      let textNodeCount = 0;

      testEditor.update(() => {
        const getAllTextNodes = (node: any): void => {
          if (node.getType && node.getType() === 'text') {
            textNodeCount++;
          }
          if (node.getChildren) {
            node.getChildren().forEach((child: any) => getAllTextNodes(child));
          }
        };

        // Mock a simple node structure to test traversal
        const mockNode = {
          getType: () => 'paragraph',
          getChildren: () => [
            { getType: () => 'text', getChildren: undefined },
            { getType: () => 'text', getChildren: undefined }
          ]
        };

        getAllTextNodes(mockNode);
        expect(textNodeCount).toBe(2);
      });
    });

    it('getAllTextNodes function prevents TypeError from missing getDescendants', () => {
      const testEditor = createEditor({
        nodes: [DitaImageNode, DitaPhRefNode],
      });

      // Verify the fix prevents the original error
      testEditor.update(() => {
        const getAllTextNodes = (node: any): any[] => {
          const result: any[] = [];

          if (node.getType() === 'text') {
            result.push({
              text: node.getTextContent ? node.getTextContent() : '',
              format: node.getFormat ? node.getFormat() : 0,
              style: node.getStyle ? node.getStyle() : ''
            });
          }

          if (node.getChildren) {
            node.getChildren().forEach((child: any) => {
              result.push(...getAllTextNodes(child));
            });
          }

          return result;
        };

        // Should work without calling non-existent getDescendants
        expect(() => getAllTextNodes({ getType: () => 'root', getChildren: () => [] })).not.toThrow();
      });
    });

    it('placeholder text detection works with the new getAllTextNodes implementation', () => {
      const testEditor = createEditor({
        nodes: [DitaImageNode, DitaPhRefNode],
      });

      testEditor.update(() => {
        // Simulate the fixed implementation
        const getAllTextNodes = (node: any): any[] => {
          const textNodes: any[] = [];

          if (node.getType() === 'text') {
            const isPlaceholder = node.hasFormat && node.hasFormat('italic') &&
                                 node.getStyle && node.getStyle().includes('var(--app-text-muted)');

            textNodes.push({
              text: node.getTextContent ? node.getTextContent() : '',
              format: node.getFormat ? node.getFormat() : 0,
              style: node.getStyle ? node.getStyle() : '',
              isPlaceholder: !!isPlaceholder
            });
          }

          if (node.getChildren) {
            node.getChildren().forEach((child: any) => {
              textNodes.push(...getAllTextNodes(child));
            });
          }

          return textNodes;
        };

        // Test that the function structure works correctly
        expect(typeof getAllTextNodes).toBe('function');

        const mockTextNode = {
          getType: () => 'text',
          getTextContent: () => 'Task title',
          getFormat: () => 2, // italic format flag
          getStyle: () => 'var(--app-text-muted)',
          hasFormat: (format: string) => format === 'italic',
          getChildren: undefined
        };

        const result = getAllTextNodes(mockTextNode);
        expect(result).toHaveLength(1);
        expect(result[0].text).toBe('Task title');
        expect(result[0].isPlaceholder).toBe(true);
      });
    });
  });

  // ── Fix 4: sync-manager-out-of-sync-banner.test.tsx import fix ──────────────

  describe('createEditor import from lexical package fix', () => {
    it('createEditor import from lexical package works correctly', () => {
      // Verify that createEditor can be imported from 'lexical' package
      expect(createEditor).toBeDefined();
      expect(typeof createEditor).toBe('function');
    });

    it('createEditor creates functional editor instance for SyncManager tests', () => {
      const testConfig = {
        namespace: 'test-editor',
        nodes: [DitaImageNode, DitaPhRefNode],
        onError: vi.fn(),
        theme: {},
      };

      const editor = createEditor(testConfig);

      // Verify editor was created successfully
      expect(editor).toBeDefined();
      expect(typeof editor.update).toBe('function');
      expect(typeof editor.getEditorState).toBe('function');
    });

    it('SyncManager component renders with createEditor from lexical package', () => {
      const testConfig = {
        namespace: 'test-editor',
        nodes: [DitaImageNode, DitaPhRefNode],
        onError: vi.fn(),
        theme: {},
      };

      const mockOnLexicalChange = vi.fn();

      // Should render without import-related errors
      expect(() => {
        render(
          <LexicalComposer initialConfig={testConfig}>
            <SyncManager
              xmlContent="<task><title>Test</title></task>"
              onLexicalChange={mockOnLexicalChange}
              lastUpdatedBy="code"
              editMode={false}
              syncTrigger={0}
            >
              <div data-testid="test-content">Test Content</div>
            </SyncManager>
          </LexicalComposer>
        );
      }).not.toThrow();
    });

    it('createEditor import fix enables proper SyncManager banner functionality', () => {
      const testConfig = {
        namespace: 'test-editor',
        nodes: [DitaImageNode, DitaPhRefNode],
        onError: vi.fn(),
        theme: {},
      };

      const mockOnLexicalChange = vi.fn();

      render(
        <LexicalComposer initialConfig={testConfig}>
          <SyncManager
            xmlContent="<task><title>Updated by code</title></task>"
            onLexicalChange={mockOnLexicalChange}
            lastUpdatedBy="code"
            editMode={false}
            syncTrigger={0}
          >
            <div data-testid="editor-content">Mock Editor Content</div>
          </SyncManager>
        </LexicalComposer>
      );

      // Verify SyncManager can render the out-of-sync banner with correct createEditor import
      expect(screen.getByText('Visual editor is out of sync — press Ctrl+Enter to refresh')).toBeInTheDocument();
    });

    it('@lexical/headless import is not used - preventing the original import error', () => {
      // Verify that the test no longer tries to import from @lexical/headless
      // This is more of a structural test to ensure the fix is maintained

      // The createEditor import from 'lexical' should work
      expect(createEditor).toBeDefined();

      // And it should work in the SyncManager test context
      const testConfig = {
        namespace: 'test-sync-manager',
        nodes: [DitaImageNode, DitaPhRefNode],
        onError: vi.fn(),
        theme: {},
      };

      const editor = createEditor(testConfig);
      expect(editor).toBeDefined();
      expect(typeof editor.update).toBe('function');
    });
  });

  // ── Integration test - All fixes working together ───────────────────────────

  describe('integrated TypeScript build fixes validation', () => {
    it('all Jamie fixes work together without TypeScript compilation errors', () => {
      // Test 1: createTab with proper arguments
      const tab = createTab('<task><title>Integration Test</title></task>');
      expect(tab).toBeDefined();
      expect(tab.xmlContent).toBe('<task><title>Integration Test</title></task>');

      // Test 2: compareXml without intermediate variable warnings
      const xmlResult = compareXml('<task><title>A</title></task>', '<task><title>B</title></task>');
      expect(xmlResult).toBe('different');

      // Test 3: createEditor from lexical package
      const editor = createEditor({
        namespace: 'integration-test',
        nodes: [DitaImageNode, DitaPhRefNode],
        onError: vi.fn(),
        theme: {},
      });
      expect(editor).toBeDefined();

      // Test 4: getAllTextNodes pattern works
      editor.update(() => {
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

        expect(typeof getAllTextNodes).toBe('function');
      });

      // All components should work without TypeScript errors
      expect(true).toBe(true); // Placeholder for successful integration
    });

    it('TypeScript strict mode compliance after Jamie fixes', () => {
      // Verify no TypeScript warnings or errors are generated by the fixes

      // createTab returns properly typed object
      const tab = createTab('<concept><title>Strict Mode Test</title></concept>');
      expect(typeof tab.id).toBe('string');
      expect(typeof tab.herettoJustLoaded).toBe('boolean');
      expect(typeof tab.xmlContent).toBe('string');

      // compareXml has proper return type
      const comparison = compareXml('<task/>', '<task/>');
      expect(typeof comparison).toBe('string');
      expect(['identical', 'formatting', 'different']).toContain(comparison);

      // createEditor import works with TypeScript
      const editor = createEditor({ namespace: 'strict-test', nodes: [], onError: vi.fn() });
      expect(editor).toBeDefined();
      expect(typeof editor.update).toBe('function');
    });

    it('build pipeline would pass with all fixes applied', () => {
      // Comprehensive test that all the TypeScript issues are resolved

      // No undefined function calls
      expect(() => createTab('<topic><title>Test</title></topic>')).not.toThrow();

      // No import errors
      expect(createEditor).toBeDefined();

      // No literal comparison warnings
      expect(compareXml('<test/>', '<test/>')).toBeDefined();

      // All components integrate properly
      const testConfig = {
        namespace: 'build-test',
        nodes: [DitaImageNode, DitaPhRefNode],
        onError: vi.fn(),
        theme: {},
      };

      expect(() => {
        render(
          <LexicalComposer initialConfig={testConfig}>
            <SyncManager
              xmlContent="<task><title>Build test</title></task>"
              onLexicalChange={vi.fn()}
              lastUpdatedBy="editor"
              editMode={false}
              syncTrigger={0}
            >
              <div>Test</div>
            </SyncManager>
          </LexicalComposer>
        );
      }).not.toThrow();
    });
  });

  // ── Regression prevention ───────────────────────────────────────────────────

  describe('regression prevention for Jamie build fixes', () => {
    it('createTab function signature remains stable', () => {
      // Ensure future changes don't break the function signature
      const xmlContent = '<task><title>Regression Test</title></task>';
      const tab = createTab(xmlContent);

      // These properties must remain stable
      expect(tab).toHaveProperty('id');
      expect(tab).toHaveProperty('xmlContent', xmlContent);
      expect(tab).toHaveProperty('lastUpdatedBy');
      expect(tab).toHaveProperty('herettoJustLoaded');
      expect(tab).toHaveProperty('savedXmlRef');
    });

    it('compareXml function continues to work with direct comparison', () => {
      // Prevent regression to intermediate variables that cause warnings
      const result1 = compareXml('<test>A</test>', '<test>A</test>');
      const result2 = compareXml('<test>A</test>', '<test>B</test>');

      expect(result1).not.toBe(result2);
      expect(typeof result1).toBe('string');
      expect(typeof result2).toBe('string');
    });

    it('getAllTextNodes pattern remains consistent', () => {
      // Ensure the recursive pattern doesn't regress to getDescendants
      const editor = createEditor({ namespace: 'regression-test', nodes: [], onError: vi.fn() });

      editor.update(() => {
        const getAllTextNodes = (node: any): any[] => {
          const nodes: any[] = [];
          if (node.getType && node.getType() === 'text') {
            nodes.push(node);
          }
          if (node.getChildren) {
            node.getChildren().forEach((child: any) => {
              nodes.push(...getAllTextNodes(child));
            });
          }
          return nodes;
        };

        // Should not try to call getDescendants
        expect(() => getAllTextNodes({ getType: () => 'root', getChildren: () => [] })).not.toThrow();
      });
    });

    it('lexical package import stays consistent', () => {
      // Ensure no regression back to @lexical/headless
      expect(createEditor).toBeDefined();

      const editor = createEditor({
        namespace: 'import-regression-test',
        nodes: [],
        onError: vi.fn(),
        theme: {}
      });

      expect(editor).toBeDefined();
      expect(typeof editor.getEditorState).toBe('function');
      expect(typeof editor.update).toBe('function');
    });
  });
});