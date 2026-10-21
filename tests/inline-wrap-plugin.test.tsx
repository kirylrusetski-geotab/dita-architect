// @vitest-environment jsdom
//
// ADR-010 slice B through the real component tree: SyncManager provides the
// originMap, InlineWrapPlugin handles the commands and the shortcut, and
// SuggestionPlugin blocks both commands in suggesting mode (I6).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import {
  $getRoot,
  $isElementNode,
  $isTextNode,
  $createRangeSelection,
  $setSelection,
  KEY_DOWN_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  type TextNode,
} from 'lexical';
import { EDITOR_NODES } from '../constants/editor-nodes';
import { SyncManager } from '../components/SyncManager';
import { SuggestionPlugin } from '../components/SuggestionPlugin';
import { InlineWrapPlugin, WRAP_INLINE_COMMAND, UNWRAP_INLINE_COMMAND } from '../components/InlineWrapPlugin';
import type { DocumentMode } from '../types/tab';

const toastFn = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({
  toast: Object.assign(toastFn, { warning: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="p"><title>T</title><conbody><p>Open the Settings page and read the <xref href="old.dita" format="dita">old guide</xref> now.</p></conbody></concept>`;

function findText(node: LexicalNode, needle: string): TextNode | null {
  if ($isTextNode(node) && node.getTextContent().includes(needle)) return node;
  if ($isElementNode(node)) for (const c of node.getChildren()) { const r = findText(c, needle); if (r) return r; }
  return null;
}
function $select(needle: string) {
  const t = findText($getRoot(), needle);
  if (!t) throw new Error(`no "${needle}"`);
  const s = t.getTextContent().indexOf(needle);
  const sel = $createRangeSelection();
  sel.anchor.set(t.getKey(), s, 'text');
  sel.focus.set(t.getKey(), s + needle.length, 'text');
  $setSelection(sel);
}

let editorRef: LexicalEditor | null = null;
const Capture = () => { const [e] = useLexicalComposerContext(); editorRef = e; return null; };

async function mount(documentMode: DocumentMode = 'editing') {
  const onLexicalChange = vi.fn();
  render(
    <LexicalComposer initialConfig={{ namespace: 'wrap', nodes: EDITOR_NODES, onError: (e: Error) => { throw e; }, theme: {} }}>
      <RichTextPlugin contentEditable={<ContentEditable />} placeholder={null} ErrorBoundary={LexicalErrorBoundary} />
      <LinkPlugin />
      <Capture />
      <SyncManager xmlContent={XML} onLexicalChange={onLexicalChange} lastUpdatedBy="code" suspendSync={documentMode === 'suggesting'}>
        <InlineWrapPlugin />
        <SuggestionPlugin
          tabId="t"
          documentMode={documentMode}
          masterXml={XML}
          acceptAllTrigger={0}
          rejectAllTrigger={0}
          onAcceptAll={vi.fn()}
          onRejectAll={vi.fn()}
          onChangeCountChanged={vi.fn()}
        />
      </SyncManager>
    </LexicalComposer>
  );
  // Let SyncManager's mount parse commit and release its "syncing from XML" flag.
  await act(async () => { await new Promise(r => setTimeout(r, 250)); });
  return { onLexicalChange, editor: editorRef! };
}

const lastXml = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1]?.[0] as string | undefined;

const run = async (editor: LexicalEditor, fn: () => void) => {
  await act(async () => {
    editor.update(fn, { discrete: true });
    await new Promise(r => setTimeout(r, 50));
  });
};

beforeEach(() => { toastFn.mockClear(); editorRef = null; });

describe('InlineWrapPlugin — commands through the real tree', () => {
  it('WRAP_INLINE_COMMAND wraps the selection and the sync emits exactly that change', async () => {
    const { editor, onLexicalChange } = await mount();
    await run(editor, () => { $select('Settings'); editor.dispatchCommand(WRAP_INLINE_COMMAND, { tag: 'uicontrol' }); });
    expect(lastXml(onLexicalChange)).toBe(XML.replace('Settings', '<uicontrol>Settings</uicontrol>'));
  });

  it('UNWRAP_INLINE_COMMAND after a wrap returns the original XML', async () => {
    const { editor, onLexicalChange } = await mount();
    await run(editor, () => { $select('Settings'); editor.dispatchCommand(WRAP_INLINE_COMMAND, { tag: 'filepath' }); });
    await run(editor, () => { $select('Settings'); editor.dispatchCommand(UNWRAP_INLINE_COMMAND, undefined); });
    expect(lastXml(onLexicalChange)).toBe(XML);
  });

  it('Insert Link on new text wraps it in an <xref> with the chosen format and scope', async () => {
    const { editor, onLexicalChange } = await mount();
    await run(editor, () => {
      $select('Settings');
      editor.dispatchCommand(WRAP_INLINE_COMMAND, { tag: 'xref', attrs: { href: 'settings.dita', format: 'dita', scope: 'peer' } });
    });
    expect(lastXml(onLexicalChange)).toBe(XML.replace('Settings', '<xref href="settings.dita" format="dita" scope="peer">Settings</xref>'));
  });

  it('Insert Link inside an existing link retargets it (previous behaviour kept)', async () => {
    const { editor, onLexicalChange } = await mount();
    await run(editor, () => {
      $select('old guide');
      editor.dispatchCommand(WRAP_INLINE_COMMAND, { tag: 'xref', attrs: { href: 'new.dita' } });
    });
    expect(lastXml(onLexicalChange)).toBe(XML.replace('href="old.dita"', 'href="new.dita"'));
  });

  it('a refused wrap leaves the document alone and tells the author why', async () => {
    const { editor, onLexicalChange } = await mount();
    await run(editor, () => {
      $select('old guide');
      editor.dispatchCommand(WRAP_INLINE_COMMAND, { tag: 'term' });
    });
    expect(lastXml(onLexicalChange) ?? XML).toBe(XML);
    expect(toastFn).toHaveBeenCalledWith('The selection touches an existing inline element. Select plain text only');
  });

  it('⌘⇧U is claimed by the plugin (so Lexical never sees it as ⌘U underline) and wraps in <uicontrol>', async () => {
    const { editor, onLexicalChange } = await mount();
    let claimed: boolean | undefined;
    await run(editor, () => {
      $select('Settings');
      claimed = editor.dispatchCommand(KEY_DOWN_COMMAND, new KeyboardEvent('keydown', { key: 'U', metaKey: true, shiftKey: true }));
    });
    expect(claimed).toBe(true);
    expect(lastXml(onLexicalChange)).toBe(XML.replace('Settings', '<uicontrol>Settings</uicontrol>'));
  });

  it('Ctrl+Shift+C wraps in <codeph>; plain ⌘U is left to Lexical', async () => {
    const { editor, onLexicalChange } = await mount();
    let plainU: boolean | undefined;
    await run(editor, () => {
      $select('Settings');
      editor.dispatchCommand(KEY_DOWN_COMMAND, new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, shiftKey: true }));
    });
    await run(editor, () => {
      $select('read');
      plainU = editor.dispatchCommand(KEY_DOWN_COMMAND, new KeyboardEvent('keydown', { key: 'u', metaKey: true }));
    });
    expect(plainU).toBe(false);
    expect(lastXml(onLexicalChange)).toBe(XML.replace('Settings', '<codeph>Settings</codeph>'));
  });
});

describe('I6 — suggesting mode blocks wrap and unwrap with a toast', () => {
  it('wrap is blocked: the tree is unchanged and the author is told why', async () => {
    const { editor } = await mount('suggesting');
    const before = editor.getEditorState().read(() => $getRoot().getTextContent());
    await run(editor, () => { $select('Settings'); editor.dispatchCommand(WRAP_INLINE_COMMAND, { tag: 'uicontrol' }); });
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe(before);
      const t = findText($getRoot(), 'Settings');
      expect(t?.getTextContent()).not.toBe('Settings'); // never split out into its own node
    });
    expect(toastFn).toHaveBeenCalledWith("Inline elements aren't tracked yet — switch to Editing mode");
  });

  it('⌘⇧U in suggesting mode is claimed and blocked: no wrap, no tracked insertion, a toast', async () => {
    const realNow = Date.now.bind(Date);
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 20_000);
    const { editor } = await mount('suggesting');
    toastFn.mockClear();
    const before = editor.getEditorState().read(() => $getRoot().getTextContent());
    let claimed: boolean | undefined;
    await run(editor, () => {
      $select('Settings');
      claimed = editor.dispatchCommand(KEY_DOWN_COMMAND, new KeyboardEvent('keydown', { key: 'U', metaKey: true, shiftKey: true }));
    });
    expect(claimed).toBe(true);
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe(before);
      const tracked: string[] = [];
      const walk = (n: LexicalNode) => { if (n.getType() === 'tracked-text') tracked.push(n.getTextContent()); if ($isElementNode(n)) n.getChildren().forEach(walk); };
      walk($getRoot());
      expect(tracked).toEqual([]);
    });
    expect(toastFn).toHaveBeenCalledWith("Inline elements aren't tracked yet — switch to Editing mode");
    nowSpy.mockRestore();
  });

  it('unwrap is blocked too', async () => {
    // SuggestionPlugin throttles each toast category for 4 s (module-level);
    // step past the previous tests' 'inline' toasts (each test moves the clock
    // further than the one before it).
    const realNow = Date.now.bind(Date);
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 40_000);
    const { editor } = await mount('suggesting');
    toastFn.mockClear();
    await run(editor, () => { $select('old guide'); editor.dispatchCommand(UNWRAP_INLINE_COMMAND, undefined); });
    editor.getEditorState().read(() => {
      expect(findText($getRoot(), 'old guide')?.getParent()?.getType()).toBe('link');
    });
    expect(toastFn).toHaveBeenCalledWith("Inline elements aren't tracked yet — switch to Editing mode");
    nowSpy.mockRestore();
  });
});
