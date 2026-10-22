// @vitest-environment jsdom
//
// BUG-39 — typed text right at a stamped <uicontrol>/<wintitle> token's
// boundary must not inherit its presentational bold/italic (ADR-010 M1).
// See lib/token-format-reset.ts for the mechanism this pins.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isElementNode,
  $isTextNode,
  $createRangeSelection,
  $setSelection,
  SELECTION_CHANGE_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  type TextNode,
  type RangeSelection,
} from 'lexical';
import { EDITOR_NODES } from '../constants/editor-nodes';
import { SyncManager } from '../components/SyncManager';
import { TokenFormatResetPlugin } from '../components/TokenFormatResetPlugin';
import { createTestEditor } from './helpers/createTestEditor';
import { parseXmlToLexical } from '../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../sync/nodeOriginMap';
import { $resetStampedFormatAtCaret } from '../lib/token-format-reset';

const DOC = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="c"><title>T</title><conbody>${body}</conbody></concept>`;

function findText(node: LexicalNode, needle: string): TextNode | null {
  if ($isTextNode(node) && node.getTextContent() === needle) return node;
  if ($isElementNode(node)) for (const c of node.getChildren()) { const r = findText(c, needle); if (r) return r; }
  return null;
}

/**
 * Collapsed selection at `offset` inside the node whose text is exactly
 * `needle`, with `.format` set the way Lexical's own selectionchange handler
 * sets it (`selection.format = anchorNode.getFormat()`) — `$setSelection` in a
 * test does not run that handler, so it is reproduced here to exercise the
 * exact mechanism BUG-39 depends on.
 */
function $selectAtBoundary(needle: string, offset: number): void {
  const t = findText($getRoot(), needle);
  if (!t) throw new Error(`no text node is exactly "${needle}"`);
  const sel = $createRangeSelection();
  sel.anchor.set(t.getKey(), offset, 'text');
  sel.focus.set(t.getKey(), offset, 'text');
  sel.format = t.getFormat();
  $setSelection(sel);
}

describe('$resetStampedFormatAtCaret (unit)', () => {
  it('clears bold at the end of a <uicontrol> token, so typed text stays plain', () => {
    const xml = DOC('<p>Click <uicontrol>Save</uicontrol> to finish.</p>');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.update(() => {
      $selectAtBoundary('Save', 4); // end of "Save"
      // The bug's mechanism, reproduced before the fix runs:
      expect(($getSelection() as RangeSelection).hasFormat('bold')).toBe(true);
      $resetStampedFormatAtCaret(originMap);
      const sel = $getSelection();
      expect($isRangeSelection(sel) && sel.hasFormat('bold')).toBe(false);
      (sel as RangeSelection).insertText(' now');
    }, { discrete: true });
    const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
    expect(out).toBe(xml.replace('</uicontrol> to', '</uicontrol> now to'));
  });

  it('clears bold at the start of a <uicontrol> token, so text typed right before it stays plain', () => {
    const xml = DOC('<p>Click <uicontrol>Save</uicontrol> to finish.</p>');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.update(() => {
      $selectAtBoundary('Save', 0); // start of "Save"
      $resetStampedFormatAtCaret(originMap);
      const sel = $getSelection();
      expect($isRangeSelection(sel) && sel.hasFormat('bold')).toBe(false);
      (sel as RangeSelection).insertText('Please ');
    }, { discrete: true });
    const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
    expect(out).toBe(xml.replace('Click ', 'Click Please '));
  });

  it('clears italic at a <wintitle> boundary', () => {
    const xml = DOC('<p>Open <wintitle>Options</wintitle> now.</p>');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.update(() => {
      $selectAtBoundary('Options', 7); // end of "Options"
      expect(($getSelection() as RangeSelection).hasFormat('italic')).toBe(true);
      $resetStampedFormatAtCaret(originMap);
      (($getSelection()) as RangeSelection).insertText(' dialog');
    }, { discrete: true });
    const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
    expect(out).toBe(xml.replace('</wintitle> now', '</wintitle> dialog now'));
  });

  it('does nothing beside a stamped tag with no presentational format (term)', () => {
    const xml = DOC('<p>Define <term>trip</term> here.</p>');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.update(() => {
      $selectAtBoundary('trip', 4);
      const before = ($getSelection() as RangeSelection).format;
      $resetStampedFormatAtCaret(originMap);
      expect(($getSelection() as RangeSelection).format).toBe(before);
    }, { discrete: true });
  });

  it('a non-collapsed selection is left alone', () => {
    const xml = DOC('<p>Click <uicontrol>Save</uicontrol> to finish.</p>');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.update(() => {
      const t = findText($getRoot(), 'Save')!;
      const sel = $createRangeSelection();
      sel.anchor.set(t.getKey(), 0, 'text');
      sel.focus.set(t.getKey(), 4, 'text');
      sel.format = t.getFormat();
      $setSelection(sel);
      $resetStampedFormatAtCaret(originMap);
      expect(($getSelection() as RangeSelection).hasFormat('bold')).toBe(true);
    }, { discrete: true });
  });

  it('a caret elsewhere in the same paragraph (not at the token boundary) is left alone', () => {
    const xml = DOC('<p>Click <uicontrol>Save</uicontrol> to finish.</p>');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.update(() => {
      $selectAtBoundary(' to finish.', 3); // inside the plain trailing text, not on the token
      const before = ($getSelection() as RangeSelection).format;
      $resetStampedFormatAtCaret(originMap);
      expect(($getSelection() as RangeSelection).format).toBe(before);
    }, { discrete: true });
  });
});

let editorRef: LexicalEditor | null = null;
const Capture = () => { const [e] = useLexicalComposerContext(); editorRef = e; return null; };

async function mount(xml: string) {
  const onLexicalChange = vi.fn();
  render(
    <LexicalComposer initialConfig={{ namespace: 'tfr', nodes: EDITOR_NODES, onError: (e: Error) => { throw e; }, theme: {} }}>
      <RichTextPlugin contentEditable={<ContentEditable />} placeholder={null} ErrorBoundary={LexicalErrorBoundary} />
      <Capture />
      <SyncManager xmlContent={xml} onLexicalChange={onLexicalChange} lastUpdatedBy="code">
        <TokenFormatResetPlugin />
      </SyncManager>
    </LexicalComposer>
  );
  await act(async () => { await new Promise(r => setTimeout(r, 250)); });
  return { onLexicalChange, editor: editorRef! };
}

const lastXml = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1]?.[0] as string | undefined;

describe('TokenFormatResetPlugin — through the real tree', () => {
  it('typing after the last <uicontrol> of a <menucascade> stays plain (the v0.10.2 smoke scenario)', async () => {
    const XML = DOC('<p>Go to <menucascade><uicontrol>File</uicontrol><uicontrol>Save</uicontrol></menucascade> now.</p>');
    const { editor, onLexicalChange } = await mount(XML);
    await act(async () => {
      editor.update(() => {
        $selectAtBoundary('Save', 4);
        editor.dispatchCommand(SELECTION_CHANGE_COMMAND, undefined);
        ($getSelection() as RangeSelection).insertText(' As');
      }, { discrete: true });
      await new Promise(r => setTimeout(r, 50));
    });
    expect(lastXml(onLexicalChange)).toBe(XML.replace('</menucascade> now.', '</menucascade> As now.'));
  });

  it('typing right after a plain <uicontrol> (not in a cascade) stays plain', async () => {
    const XML = DOC('<p>Click <uicontrol>Save</uicontrol> to finish.</p>');
    const { editor, onLexicalChange } = await mount(XML);
    await act(async () => {
      editor.update(() => {
        $selectAtBoundary('Save', 4);
        editor.dispatchCommand(SELECTION_CHANGE_COMMAND, undefined);
        ($getSelection() as RangeSelection).insertText(' now');
      }, { discrete: true });
      await new Promise(r => setTimeout(r, 50));
    });
    expect(lastXml(onLexicalChange)).toBe(XML.replace('</uicontrol> to', '</uicontrol> now to'));
  });
});
