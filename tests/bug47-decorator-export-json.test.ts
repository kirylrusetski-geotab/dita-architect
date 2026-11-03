// BUG-47 — six decorator nodes' exportJSON always threw.
//
// Lexical 0.16's DecoratorNode defines no exportJSON, so `...super.exportJSON()`
// reaches LexicalNode's base, which throws "exportJSON: base method not
// extended". DitaPhRefNode had the same defect and was fixed for BUG-46 by
// dropping the spread and returning `type`/`version` directly — the fix here
// is the same for the other six. User-visible effect: Lexical's clipboard
// copy ($generateJSONFromSelectedNodes) and editorState.toJSON() call
// exportJSON, so copying a selection holding any of these nodes threw.
import { describe, it, expect } from 'vitest';
import { $getRoot, $getSelection } from 'lexical';
import { createTestEditor } from './helpers/createTestEditor';
import { DitaCodeBlockNode, $createDitaCodeBlockNode } from '../components/DitaCodeBlockNode';
import { ValidationDecoratorNode, $createValidationDecoratorNode } from '../components/ValidationDecoratorNode';
import { DitaOpaqueNode, $createDitaOpaqueNode } from '../components/DitaOpaqueNode';
import { DitaInfoPreviewNode, $createDitaInfoPreviewNode } from '../components/DitaInfoPreviewNode';
import { DitaContainerBoundaryNode, $createDitaContainerBoundaryNode } from '../components/DitaContainerBoundaryNode';
import { DitaImageNode, $createDitaImageNode } from '../components/DitaImageNode';

describe('BUG-47: exportJSON no longer throws, and round-trips through importJSON', () => {
  it('DitaCodeBlockNode', () => {
    const editor = createTestEditor();
    editor.update(() => {
      const node = $createDitaCodeBlockNode('console.log(1)', 'javascript');
      const json = node.exportJSON();
      expect(json).toMatchObject({ type: 'ditacodeblock', version: 1, code: 'console.log(1)', language: 'javascript' });
      const imported = DitaCodeBlockNode.importJSON(json);
      expect(imported.getType()).toBe('ditacodeblock');
    }, { discrete: true });
  });

  it('ValidationDecoratorNode', () => {
    const editor = createTestEditor();
    editor.update(() => {
      const node = $createValidationDecoratorNode('bad.dita', 'broken-xref', 'Target not found');
      const json = node.exportJSON();
      expect(json).toMatchObject({ type: 'validation-decorator', version: 1, href: 'bad.dita', errorType: 'broken-xref', errorMessage: 'Target not found' });
      const imported = ValidationDecoratorNode.importJSON(json);
      expect(imported.getType()).toBe('validation-decorator');
    }, { discrete: true });
  });

  it('DitaOpaqueNode', () => {
    const editor = createTestEditor();
    editor.update(() => {
      const node = $createDitaOpaqueNode('fig', '<fig><title>F</title></fig>');
      const json = node.exportJSON();
      expect(json).toMatchObject({ type: 'ditaopaque', version: 1, tagName: 'fig', xmlContent: '<fig><title>F</title></fig>' });
      const imported = DitaOpaqueNode.importJSON(json);
      expect(imported.getType()).toBe('ditaopaque');
    }, { discrete: true });
  });

  it('DitaInfoPreviewNode', () => {
    const editor = createTestEditor();
    editor.update(() => {
      const content = [{ type: 'element' as const, tag: 'p', text: 'Hello', children: [] }];
      const node = $createDitaInfoPreviewNode(content);
      const json = node.exportJSON();
      expect(json).toMatchObject({ type: 'dita-info-preview', version: 1, content });
      const imported = DitaInfoPreviewNode.importJSON(json);
      expect(imported.getType()).toBe('dita-info-preview');
    }, { discrete: true });
  });

  it('DitaContainerBoundaryNode', () => {
    const editor = createTestEditor();
    editor.update(() => {
      const node = $createDitaContainerBoundaryNode('condition');
      const json = node.exportJSON();
      expect(json).toMatchObject({ type: 'dita-container-boundary', version: 1, kind: 'condition' });
      const imported = DitaContainerBoundaryNode.importJSON(json);
      expect(imported.getType()).toBe('dita-container-boundary');
    }, { discrete: true });
  });

  it('DitaImageNode', () => {
    const editor = createTestEditor();
    editor.update(() => {
      const node = $createDitaImageNode('img.png', 'alt text', '', false);
      const json = node.exportJSON();
      expect(json).toMatchObject({ type: 'ditaimage', version: 1, href: 'img.png', alt: 'alt text' });
      const imported = DitaImageNode.importJSON(json);
      expect(imported.getType()).toBe('ditaimage');
    }, { discrete: true });
  });

  // The actual user-visible symptom BUG-47's rationale named as the likely one:
  // clipboard copy and editorState.toJSON() both call exportJSON on every node
  // in scope, so a selection or state holding any of these six used to throw.
  it('editorState.toJSON() does not throw when the state holds every one of the six node types', () => {
    const editor = createTestEditor();
    editor.update(() => {
      const root = $getRoot();
      root.append($createDitaCodeBlockNode('x', 'text'));
      root.append($createValidationDecoratorNode('bad.dita', 'broken-xref', 'msg'));
      root.append($createDitaOpaqueNode('fig', '<fig/>'));
      root.append($createDitaInfoPreviewNode([]));
      root.append($createDitaContainerBoundaryNode('cause'));
      root.append($createDitaImageNode('img.png', '', '', false));
    }, { discrete: true });
    expect(() => editor.getEditorState().toJSON()).not.toThrow();
  });

  it('$generateJSONFromSelectedNodes does not throw for a selection that includes these nodes (the clipboard-copy path)', async () => {
    const { $generateJSONFromSelectedNodes } = await import('@lexical/clipboard');
    const editor = createTestEditor();
    let threw: unknown = null;
    editor.update(() => {
      const root = $getRoot();
      root.append($createDitaCodeBlockNode('x', 'text'));
      root.append($createDitaImageNode('img.png', '', '', false));
      root.selectStart();
      root.selectEnd();
      const selection = $getSelection();
      try {
        if (selection) $generateJSONFromSelectedNodes(editor, selection);
      } catch (e) {
        threw = e;
      }
    }, { discrete: true });
    expect(threw).toBeNull();
  });
});
