// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createEditor, $getRoot, $createTextNode } from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode } from '@lexical/link';
import { TableNode, TableRowNode, TableCellNode } from '@lexical/table';
import { DitaOpaqueNode } from '../components/DitaOpaqueNode';
import { DitaCodeBlockNode } from '../components/DitaCodeBlockNode';
import { DitaImageNode } from '../components/DitaImageNode';
import { DitaPhRefNode } from '../components/DitaPhRefNode';
import { parseXmlToLexical } from '../sync/parseXmlToLexical';
import { createNodeOriginMap } from '../sync/nodeOriginMap';

// ─── test utilities ──────────────────────────────────────────────────────────

function createTestEditor() {
  return createEditor({
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      LinkNode,
      TableNode,
      TableRowNode,
      TableCellNode,
      DitaOpaqueNode,
      DitaCodeBlockNode,
      DitaImageNode,
      DitaPhRefNode,
    ],
  });
}

function parseAndGetTextNodes(xmlContent: string) {
  const editor = createTestEditor();
  const originMap = createNodeOriginMap();
  let textNodes: any[] = [];

  // Parse the XML and extract text nodes
  const result = parseXmlToLexical(xmlContent, editor, originMap, true);

  if (result) {
    const editorState = editor.getEditorState();
    editorState.read(() => {
      const root = $getRoot();

      const getAllTextNodes = (node: any): void => {
        if (node.getType() === 'text') {
          textNodes.push({
            text: node.getTextContent(),
            format: node.getFormat(),
            style: node.getStyle(),
            isPlaceholder: node.hasFormat('italic') && node.getStyle().includes('var(--app-text-muted)')
          });
        }
        if (node.getChildren) {
          node.getChildren().forEach((child: any) => getAllTextNodes(child));
        }
      };

      getAllTextNodes(root);
    });
  }

  return textNodes;
}

// ─── Placeholder text detection and styling ─────────────────────────────────

describe('Template placeholder text detection and visual styling', () => {
  // ── core placeholder patterns ────────────────────────────────────────────

  it('detects and styles "Task title" as placeholder text', () => {
    const xml = '<task><title>Task title</title><body></body></task>';
    const textNodes = parseAndGetTextNodes(xml);

    const titleNode = textNodes.find(node => node.text === 'Task title');
    expect(titleNode).toBeDefined();
    expect(titleNode.isPlaceholder).toBe(true);
    expect(titleNode.format & 2).toBe(2); // italic format flag
    expect(titleNode.style).toContain('var(--app-text-muted)');
  });

  it('detects and styles "Short description of the task" as placeholder text', () => {
    const xml = '<task><title>Task title</title><shortdesc>Short description of the task</shortdesc></task>';
    const textNodes = parseAndGetTextNodes(xml);

    const descNode = textNodes.find(node => node.text === 'Short description of the task');
    expect(descNode).toBeDefined();
    expect(descNode.isPlaceholder).toBe(true);
    expect(descNode.format & 2).toBe(2); // italic format
    expect(descNode.style).toContain('var(--app-text-muted)');
  });

  it('detects all standard task template placeholders', () => {
    const placeholderTexts = [
      'Task title',
      'Short description of the task',
      'Brief task description',
      'Brief description',
      'Enter task title here',
      'Enter short description here',
      'Task description goes here',
      'Short task description'
    ];

    placeholderTexts.forEach(placeholderText => {
      const xml = `<task><title>${placeholderText}</title><body></body></task>`;
      const textNodes = parseAndGetTextNodes(xml);

      const placeholderNode = textNodes.find(node => node.text === placeholderText);
      expect(placeholderNode, `Failed to detect placeholder: "${placeholderText}"`).toBeDefined();
      expect(placeholderNode.isPlaceholder, `"${placeholderText}" should be styled as placeholder`).toBe(true);
    });
  });

  // ── case insensitivity ───────────────────────────────────────────────────

  it('detects placeholder text regardless of case', () => {
    const variations = [
      'TASK TITLE',
      'task title',
      'Task Title',
      'tAsK tItLe'
    ];

    variations.forEach(variation => {
      const xml = `<task><title>${variation}</title><body></body></task>`;
      const textNodes = parseAndGetTextNodes(xml);

      const placeholderNode = textNodes.find(node => node.text === variation);
      expect(placeholderNode, `Failed to detect case variation: "${variation}"`).toBeDefined();
      expect(placeholderNode.isPlaceholder, `"${variation}" should be styled as placeholder`).toBe(true);
    });
  });

  // ── non-placeholder text behavior ────────────────────────────────────────

  it('does not style legitimate content as placeholder text', () => {
    const realContent = [
      'Installing the Software',
      'How to configure user permissions',
      'System requirements and prerequisites',
      'Task completed successfully',
      'Short descriptions are helpful'
    ];

    realContent.forEach(content => {
      const xml = `<task><title>${content}</title><body></body></task>`;
      const textNodes = parseAndGetTextNodes(xml);

      const contentNode = textNodes.find(node => node.text === content);
      expect(contentNode, `Failed to find content: "${content}"`).toBeDefined();
      expect(contentNode.isPlaceholder, `"${content}" should NOT be styled as placeholder`).toBe(false);
    });
  });

  it('handles mixed content with placeholders and real text', () => {
    const xml = `
      <task>
        <title>Task title</title>
        <shortdesc>Short description of the task</shortdesc>
        <body>
          <p>This is real content that should not be styled as placeholder.</p>
          <steps>
            <step><cmd>Enter task title here</cmd></step>
            <step><cmd>Perform the actual task step</cmd></step>
          </steps>
        </body>
      </task>`;

    const textNodes = parseAndGetTextNodes(xml);

    // Placeholders should be styled
    const titlePlaceholder = textNodes.find(node => node.text === 'Task title');
    expect(titlePlaceholder?.isPlaceholder).toBe(true);

    const descPlaceholder = textNodes.find(node => node.text === 'Short description of the task');
    expect(descPlaceholder?.isPlaceholder).toBe(true);

    const cmdPlaceholder = textNodes.find(node => node.text === 'Enter task title here');
    expect(cmdPlaceholder?.isPlaceholder).toBe(true);

    // Real content should not be styled
    const realContent = textNodes.find(node => node.text === 'This is real content that should not be styled as placeholder.');
    expect(realContent?.isPlaceholder).toBe(false);

    const realStep = textNodes.find(node => node.text === 'Perform the actual task step');
    expect(realStep?.isPlaceholder).toBe(false);
  });

  // ── whitespace handling ──────────────────────────────────────────────────

  it('handles placeholder text with surrounding whitespace', () => {
    const xml = '<task><title>  Task title  </title><body></body></task>';
    const textNodes = parseAndGetTextNodes(xml);

    // The text should be trimmed and still detected as placeholder
    const titleNode = textNodes.find(node => node.text.trim() === 'Task title');
    expect(titleNode).toBeDefined();
    expect(titleNode.isPlaceholder).toBe(true);
  });

  it('handles placeholder text with line breaks and tabs', () => {
    const xml = `<task>
      <title>
        Task title
      </title>
      <shortdesc>
        Short description of the task
      </shortdesc>
    </task>`;

    const textNodes = parseAndGetTextNodes(xml);

    const titleNode = textNodes.find(node => node.text.trim() === 'Task title');
    expect(titleNode?.isPlaceholder).toBe(true);

    const descNode = textNodes.find(node => node.text.trim() === 'Short description of the task');
    expect(descNode?.isPlaceholder).toBe(true);
  });

  // ── cross-topic type support ─────────────────────────────────────────────

  it('works across different DITA topic types', () => {
    const topicTypes = ['task', 'concept', 'reference', 'topic'];

    topicTypes.forEach(topicType => {
      const xml = `<${topicType}><title>Task title</title></${topicType}>`;
      const textNodes = parseAndGetTextNodes(xml);

      const placeholderNode = textNodes.find(node => node.text === 'Task title');
      expect(placeholderNode, `Failed in ${topicType} topic`).toBeDefined();
      expect(placeholderNode.isPlaceholder, `Placeholder not styled in ${topicType}`).toBe(true);
    });
  });

  // ── WYSIWYG/DITA parity ──────────────────────────────────────────────────

  it('maintains WYSIWYG/DITA parity - styling is visual only', () => {
    const xml = '<task><title>Task title</title><shortdesc>Brief description</shortdesc></task>';
    const textNodes = parseAndGetTextNodes(xml);

    // Verify that the actual text content is preserved exactly
    const titleNode = textNodes.find(node => node.text === 'Task title');
    const descNode = textNodes.find(node => node.text === 'Brief description');

    expect(titleNode.text).toBe('Task title'); // Exact text preserved
    expect(descNode.text).toBe('Brief description'); // Exact text preserved

    // Only the styling is added, not the content itself
    expect(titleNode.isPlaceholder).toBe(true);
    expect(descNode.isPlaceholder).toBe(true);
  });

  // ── partial matches ──────────────────────────────────────────────────────

  it('does not match partial placeholder strings', () => {
    const partialMatches = [
      'Task title and more text',
      'The task title is important',
      'Short description of the task in detail',
      'A brief description follows'
    ];

    partialMatches.forEach(partial => {
      const xml = `<task><title>${partial}</title><body></body></task>`;
      const textNodes = parseAndGetTextNodes(xml);

      const textNode = textNodes.find(node => node.text === partial);
      expect(textNode, `Failed to find partial match: "${partial}"`).toBeDefined();
      expect(textNode.isPlaceholder, `"${partial}" should NOT be styled as placeholder`).toBe(false);
    });
  });

  // ── edge cases ───────────────────────────────────────────────────────────

  it('handles empty and whitespace-only text elements', () => {
    const xml = '<task><title></title><shortdesc>   </shortdesc><body><p></p></body></task>';
    const textNodes = parseAndGetTextNodes(xml);

    // Should not crash and should not detect empty text as placeholder
    textNodes.forEach(node => {
      if (node.text === '' || node.text.trim() === '') {
        expect(node.isPlaceholder).toBe(false);
      }
    });
  });

  it('handles special characters in placeholder context', () => {
    const xml = '<task><title>Task title</title><body><p>Price: $29.99</p></body></task>';
    const textNodes = parseAndGetTextNodes(xml);

    const placeholderNode = textNodes.find(node => node.text === 'Task title');
    expect(placeholderNode.isPlaceholder).toBe(true);

    const priceNode = textNodes.find(node => node.text === 'Price: $29.99');
    expect(priceNode?.isPlaceholder).toBe(false);
  });

  // ── performance considerations ────────────────────────────────────────────

  it('processes large documents with many text elements efficiently', () => {
    const largeXml = `
      <task>
        <title>Task title</title>
        <shortdesc>Short description of the task</shortdesc>
        <body>
          ${Array.from({ length: 100 }, (_, i) =>
            `<p>This is paragraph ${i + 1} with real content that should not be marked as placeholder.</p>`
          ).join('\n')}
        </body>
      </task>`;

    const start = performance.now();
    const textNodes = parseAndGetTextNodes(largeXml);
    const end = performance.now();

    // Should complete in reasonable time (less than 1 second)
    expect(end - start).toBeLessThan(1000);

    // Verify placeholders are still detected correctly
    const titleNode = textNodes.find(node => node.text === 'Task title');
    expect(titleNode?.isPlaceholder).toBe(true);

    // Verify real content is not marked as placeholder
    const realContentNodes = textNodes.filter(node =>
      node.text.startsWith('This is paragraph') && node.text.includes('real content')
    );
    expect(realContentNodes.length).toBe(100);
    realContentNodes.forEach(node => {
      expect(node.isPlaceholder).toBe(false);
    });
  });
});