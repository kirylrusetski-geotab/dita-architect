// @vitest-environment jsdom
//
// BUG-43 — a <menucascade>'s steps render with no visual separator. originMap
// stamps each step with cascadeStep at parse (inline-units.ts); the editor
// shows a CSS-only separator between two adjacent steps (CascadeSeparatorPlugin
// + index.css), never as document text.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { $getRoot, $isElementNode, $isTextNode, type LexicalEditor, type LexicalNode } from 'lexical';
import { EDITOR_NODES } from '../constants/editor-nodes';
import { SyncManager } from '../components/SyncManager';
import { CascadeSeparatorPlugin } from '../components/CascadeSeparatorPlugin';
import { createTestEditor, roundTrip } from './helpers/createTestEditor';
import { parseXmlToLexical } from '../sync/parseXmlToLexical';
import { createNodeOriginMap } from '../sync/nodeOriginMap';

const DOC = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="c"><title>T</title><conbody>${body}</conbody></concept>`;

function findText(node: LexicalNode, needle: string): LexicalNode | null {
  if ($isTextNode(node) && node.getTextContent() === needle) return node;
  if ($isElementNode(node)) for (const c of node.getChildren()) { const r = findText(c, needle); if (r) return r; }
  return null;
}

describe('BUG-43 — originMap stamps cascadeStep at parse', () => {
  it('both steps of a <menucascade> are stamped', () => {
    const xml = DOC('<p>Go to <menucascade><uicontrol>File</uicontrol><uicontrol>Save</uicontrol></menucascade> now.</p>');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.getEditorState().read(() => {
      const file = findText($getRoot(), 'File')!;
      const save = findText($getRoot(), 'Save')!;
      expect(originMap.get(file.getKey())?.cascadeStep).toBe(true);
      expect(originMap.get(save.getKey())?.cascadeStep).toBe(true);
    });
  });

  it('a standalone <uicontrol> (not in a cascade) is not stamped', () => {
    const xml = DOC('<p>Click <uicontrol>Save</uicontrol> to finish.</p>');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.getEditorState().read(() => {
      const save = findText($getRoot(), 'Save')!;
      expect(originMap.get(save.getKey())?.cascadeStep).toBeUndefined();
    });
  });

  it('a <wintitle> is never a cascade step (menucascade holds only uicontrol)', () => {
    const xml = DOC('<p>See <wintitle>Options</wintitle>.</p>');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.getEditorState().read(() => {
      const options = findText($getRoot(), 'Options')!;
      expect(originMap.get(options.getKey())?.cascadeStep).toBeUndefined();
    });
  });

  it('three steps are all stamped', () => {
    const xml = DOC('<p>Go to <menucascade><uicontrol>A</uicontrol><uicontrol>B</uicontrol><uicontrol>C</uicontrol></menucascade>.</p>');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.getEditorState().read(() => {
      for (const text of ['A', 'B', 'C']) {
        expect(originMap.get(findText($getRoot(), text)!.getKey())?.cascadeStep).toBe(true);
      }
    });
  });
});

describe('BUG-43 — the stamp is visual-only (XML is unaffected)', () => {
  it('a <menucascade> round-trips byte-stable, unedited', () => {
    const xml = DOC('<p>Go to <menucascade><uicontrol>File</uicontrol><uicontrol>Save</uicontrol></menucascade> now.</p>');
    expect(roundTrip(xml)).toBe(xml);
  });
});

describe('BUG-43 — CascadeSeparatorPlugin applies the class through the real tree', () => {
  let editorRef: LexicalEditor | null = null;
  const Capture = () => { const [e] = useLexicalComposerContext(); editorRef = e; return null; };

  async function mount(xml: string) {
    render(
      <LexicalComposer initialConfig={{ namespace: 'bug43', nodes: EDITOR_NODES, onError: (e: Error) => { throw e; }, theme: {} }}>
        <RichTextPlugin contentEditable={<ContentEditable />} placeholder={null} ErrorBoundary={LexicalErrorBoundary} />
        <Capture />
        <SyncManager xmlContent={xml} onLexicalChange={vi.fn()} lastUpdatedBy="code">
          <CascadeSeparatorPlugin />
        </SyncManager>
      </LexicalComposer>
    );
    await act(async () => { await new Promise(r => setTimeout(r, 300)); });
    return editorRef!;
  }

  it('both cascade steps get the class and are adjacent DOM siblings', async () => {
    const editor = await mount(DOC('<p>Go to <menucascade><uicontrol>File</uicontrol><uicontrol>Save</uicontrol></menucascade> now.</p>'));
    editor.getEditorState().read(() => {
      const fileEl = editor.getElementByKey(findText($getRoot(), 'File')!.getKey())!;
      const saveEl = editor.getElementByKey(findText($getRoot(), 'Save')!.getKey())!;
      expect(fileEl.classList.contains('dita-editor-cascade-step')).toBe(true);
      expect(saveEl.classList.contains('dita-editor-cascade-step')).toBe(true);
      expect(fileEl.nextElementSibling).toBe(saveEl);
    });
  });

  it('a standalone <uicontrol> does not get the class', async () => {
    const editor = await mount(DOC('<p>Click <uicontrol>OK</uicontrol> alone.</p>'));
    editor.getEditorState().read(() => {
      const okEl = editor.getElementByKey(findText($getRoot(), 'OK')!.getKey())!;
      expect(okEl.classList.contains('dita-editor-cascade-step')).toBe(false);
    });
  });

  it('a topic with both a cascade and a standalone uicontrol marks only the cascade steps', async () => {
    const editor = await mount(DOC('<p>Go to <menucascade><uicontrol>File</uicontrol><uicontrol>Save</uicontrol></menucascade> now.</p><p>Click <uicontrol>OK</uicontrol> alone.</p>'));
    editor.getEditorState().read(() => {
      const fileEl = editor.getElementByKey(findText($getRoot(), 'File')!.getKey())!;
      const saveEl = editor.getElementByKey(findText($getRoot(), 'Save')!.getKey())!;
      const okEl = editor.getElementByKey(findText($getRoot(), 'OK')!.getKey())!;
      expect(fileEl.classList.contains('dita-editor-cascade-step')).toBe(true);
      expect(saveEl.classList.contains('dita-editor-cascade-step')).toBe(true);
      expect(okEl.classList.contains('dita-editor-cascade-step')).toBe(false);
    });
  });
});
