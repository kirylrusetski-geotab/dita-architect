// @vitest-environment jsdom
/**
 * Table Structure Diagnostic Tests
 *
 * Simple diagnostic tests to understand how tables are being parsed
 * and what structure is actually created. This will help identify
 * why Elena's validation tests are failing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createEditor, $getRoot, LexicalEditor } from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode } from '@lexical/link';
import { TableNode, TableRowNode, TableCellNode, $isTableCellNode, $isTableRowNode, $isTableNode } from '@lexical/table';
import { DitaOpaqueNode } from '../components/DitaOpaqueNode';
import { DitaCodeBlockNode } from '../components/DitaCodeBlockNode';
import { DitaImageNode } from '../components/DitaImageNode';
import { DitaPhRefNode } from '../components/DitaPhRefNode';
import { parseXmlToLexical, createNodeOriginMap, serializeLexicalToXml, createXmlMetaCache } from '../sync';
import type { NodeOriginMapType } from '../sync';

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

const simpleCalsTable = `
<topic>
  <title>Simple Test</title>
  <body>
    <table>
      <tgroup cols="2">
        <thead>
          <row>
            <entry>Header 1</entry>
            <entry>Header 2</entry>
          </row>
        </thead>
        <tbody>
          <row>
            <entry>Cell 1</entry>
            <entry>Cell 2</entry>
          </row>
        </tbody>
      </tgroup>
    </table>
  </body>
</topic>
`;

describe('Table Structure Diagnostics', () => {
  let editor: LexicalEditor;
  let originMap: NodeOriginMapType;

  beforeEach(() => {
    editor = createTestEditor();
    originMap = createNodeOriginMap();
  });

  it('should successfully parse basic CALS table', () => {
    const result = parseXmlToLexical(simpleCalsTable, editor, originMap, true);
    expect(result).toBe(true);
  });

  it('should create table nodes in Lexical structure', () => {
    parseXmlToLexical(simpleCalsTable, editor, originMap, true);

    let tableFound = false;
    let rowCount = 0;
    let cellCount = 0;

    editor.getEditorState().read(() => {
      const root = $getRoot();

      const inspectNode = (node: any, depth = 0): void => {
        const indent = '  '.repeat(depth);
        console.log(`${indent}Node type: ${node.__type}`);

        if ($isTableNode(node)) {
          tableFound = true;
          console.log(`${indent}  Found table node`);
        } else if ($isTableRowNode(node)) {
          rowCount++;
          console.log(`${indent}  Found table row ${rowCount}`);
        } else if ($isTableCellNode(node)) {
          cellCount++;
          const headerStyles = node.getHeaderStyles ? node.getHeaderStyles() : 0;
          const colspan = node.getColSpan ? node.getColSpan() : 1;
          const rowspan = node.getRowSpan ? node.getRowSpan() : 1;
          const content = node.getTextContent ? node.getTextContent() : '';
          console.log(`${indent}  Found table cell ${cellCount}: header=${headerStyles}, colspan=${colspan}, rowspan=${rowspan}, content="${content}"`);
        }

        if (node.getChildren) {
          node.getChildren().forEach((child: any) => inspectNode(child, depth + 1));
        }
      };

      inspectNode(root);
    });

    console.log(`\nSummary: tableFound=${tableFound}, rowCount=${rowCount}, cellCount=${cellCount}`);

    expect(tableFound).toBe(true);
    expect(rowCount).toBeGreaterThan(0);
    expect(cellCount).toBeGreaterThan(0);
  });

  it('should round-trip through serialization correctly', () => {
    parseXmlToLexical(simpleCalsTable, editor, originMap, true);

    const editorState = editor.getEditorState();
    const cache = createXmlMetaCache();
    const serializedXml = serializeLexicalToXml(editorState, simpleCalsTable, originMap, cache);

    console.log('Original XML:');
    console.log(simpleCalsTable);
    console.log('\nSerialized XML:');
    console.log(serializedXml);

    expect(serializedXml).toContain('<table>');
    expect(serializedXml).toContain('<entry>');
    expect(serializedXml).toContain('Header 1');
    expect(serializedXml).toContain('Cell 1');
  });

  it('should validate table structure meets basic requirements', () => {
    parseXmlToLexical(simpleCalsTable, editor, originMap, true);

    let structureValid = false;
    let headerCellsFound = 0;
    let bodyCellsFound = 0;

    editor.getEditorState().read(() => {
      const root = $getRoot();

      const validateStructure = (node: any): void => {
        if ($isTableCellNode(node)) {
          // Check if this cell has header styles
          const headerStyles = node.getHeaderStyles ? node.getHeaderStyles() : 0;
          const content = node.getTextContent ? node.getTextContent().trim() : '';

          if (headerStyles > 0) {
            headerCellsFound++;
            console.log(`Header cell found: "${content}" (styles: ${headerStyles})`);
          } else {
            bodyCellsFound++;
            console.log(`Body cell found: "${content}" (styles: ${headerStyles})`);
          }
        }

        if (node.getChildren) {
          node.getChildren().forEach((child: any) => validateStructure(child));
        }
      };

      validateStructure(root);
    });

    console.log(`\nCell Analysis: headerCells=${headerCellsFound}, bodyCells=${bodyCellsFound}`);

    // Basic validation - we should have some cells
    structureValid = (headerCellsFound + bodyCellsFound) > 0;

    expect(structureValid).toBe(true);
    expect(headerCellsFound + bodyCellsFound).toBe(4); // 2 header + 2 body = 4 total
  });
});

const tableWithSpans = `
<topic>
  <title>Spans Test</title>
  <body>
    <table>
      <tgroup cols="3">
        <tbody>
          <row>
            <entry namest="col1" nameend="col2">Wide Cell</entry>
            <entry>Normal Cell</entry>
          </row>
        </tbody>
      </tgroup>
    </table>
  </body>
</topic>
`;

describe('Span Parsing Diagnostics', () => {
  let editor: LexicalEditor;
  let originMap: NodeOriginMapType;

  beforeEach(() => {
    editor = createTestEditor();
    originMap = createNodeOriginMap();
  });

  it('should parse span attributes correctly', () => {
    const result = parseXmlToLexical(tableWithSpans, editor, originMap, true);
    expect(result).toBe(true);

    let spanData: Array<{content: string, colspan: number, rowspan: number}> = [];

    editor.getEditorState().read(() => {
      const root = $getRoot();

      const collectSpanData = (node: any): void => {
        if ($isTableCellNode(node)) {
          const content = node.getTextContent ? node.getTextContent().trim() : '';
          const colspan = node.getColSpan ? node.getColSpan() : 1;
          const rowspan = node.getRowSpan ? node.getRowSpan() : 1;

          spanData.push({ content, colspan, rowspan });
          console.log(`Cell: "${content}" - colspan: ${colspan}, rowspan: ${rowspan}`);
        }

        if (node.getChildren) {
          node.getChildren().forEach((child: any) => collectSpanData(child));
        }
      };

      collectSpanData(root);
    });

    console.log('Span analysis:', spanData);

    expect(spanData.length).toBeGreaterThan(0);

    // Check if any cell has colspan > 1
    const hasColspan = spanData.some(cell => cell.colspan > 1);
    expect(hasColspan).toBe(true);
  });

  it('should serialize spans back to DITA correctly', () => {
    parseXmlToLexical(tableWithSpans, editor, originMap, true);

    const editorState = editor.getEditorState();
    const cache = createXmlMetaCache();
    const serializedXml = serializeLexicalToXml(editorState, tableWithSpans, originMap, cache);

    console.log('Original span XML:');
    console.log(tableWithSpans);
    console.log('\nSerialized span XML:');
    console.log(serializedXml);

    expect(serializedXml).toContain('Wide Cell');
    expect(serializedXml).toContain('Normal Cell');
  });
});