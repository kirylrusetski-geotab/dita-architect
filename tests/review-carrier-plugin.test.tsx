// @vitest-environment jsdom
//
// ADR-015 decisions 3, 5, 6 and 8 through the real component tree:
// SyncManager emits the carrier XML live in Suggesting mode (and still
// buffers XML-side edits), SuggestionPlugin reports marks that arrive from a
// parse so the app can open the tab in Suggesting mode, and ChangeListPanel
// lists carried suggestions by changeId + kind with their authors, plus the
// unsupported ones.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, act, screen, within } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { $getRoot, type LexicalEditor, type ParagraphNode, type TextNode } from 'lexical';
import { EDITOR_NODES } from '../constants/editor-nodes';
import { SyncManager } from '../components/SyncManager';
import { SuggestionPlugin } from '../components/SuggestionPlugin';
import { ChangeListPanel } from '../components/ChangeListPanel';
import { $insertTrackedText, $trackedParagraphSplit } from '../lib/tracked-changes/edits';
import type { TrackedMark } from '../lib/tracked-changes/model';
import type { DocumentMode } from '../types/tab';

const toastFn = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({
  toast: Object.assign(toastFn, { warning: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const PLAIN = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="p"><title>T</title><conbody><p>One sentence body paragraph.</p></conbody></concept>`;

const carrier = (name: string) => readFileSync(join(__dirname, 'sync/fixtures/review-carrier', name), 'utf-8');
const AUTHOR = 'author@example.com';

let editorRef: LexicalEditor | null = null;
const Capture = () => { const [e] = useLexicalComposerContext(); editorRef = e; return null; };

type OnLexicalChange = (serializedXml: string) => void;
type OnCarriedMarks = (tabId: string, count: number) => void;

function tree(props: { xml: string; mode: DocumentMode; lastUpdatedBy?: 'editor' | 'code' | 'api'; acceptAllTrigger?: number; onAcceptAll?: (tabId: string) => void; onLexicalChange: OnLexicalChange; onCarriedMarks: OnCarriedMarks }) {
  return (
    <LexicalComposer initialConfig={{ namespace: 'carrier', nodes: EDITOR_NODES, onError: (e: Error) => { throw e; }, theme: {} }}>
      <RichTextPlugin contentEditable={<ContentEditable />} placeholder={null} ErrorBoundary={LexicalErrorBoundary} />
      <LinkPlugin />
      <Capture />
      <SyncManager xmlContent={props.xml} onLexicalChange={props.onLexicalChange} lastUpdatedBy={props.lastUpdatedBy ?? 'code'} suspendSync={props.mode === 'suggesting'}>
        <SuggestionPlugin
          tabId="t"
          documentMode={props.mode}
          acceptAllTrigger={props.acceptAllTrigger ?? 0}
          rejectAllTrigger={0}
          onAcceptAll={props.onAcceptAll ?? vi.fn()}
          onRejectAll={vi.fn()}
          onChangeCountChanged={vi.fn()}
          onCarriedMarks={props.onCarriedMarks}
        />
        <ChangeListPanel documentMode={props.mode} xmlContent={props.xml} />
      </SyncManager>
    </LexicalComposer>
  );
}

async function mount(xml: string, mode: DocumentMode) {
  const onLexicalChange = vi.fn<OnLexicalChange>();
  const onCarriedMarks = vi.fn<OnCarriedMarks>();
  const utils = render(tree({ xml, mode, onLexicalChange, onCarriedMarks }));
  await act(async () => { await new Promise(r => setTimeout(r, 250)); });
  return { ...utils, onLexicalChange, onCarriedMarks, editor: editorRef! };
}

const lastXml = (fn: ReturnType<typeof vi.fn<OnLexicalChange>>) => fn.mock.calls[fn.mock.calls.length - 1]?.[0];
const panel = () => within(screen.getByRole('region', { name: 'Tracked changes' }));
const run = async (editor: LexicalEditor, fn: () => void) => {
  await act(async () => {
    editor.update(fn, { discrete: true });
    await new Promise(r => setTimeout(r, 50));
  });
};
const MARK: TrackedMark = { changeId: '11111111-1111-4111-8111-111111111111', kind: 'insert', author: AUTHOR, date: '2026-11-02T16:00:00.000Z' };

beforeEach(() => { toastFn.mockClear(); editorRef = null; });

describe('ADR-015 decision 5 — Suggesting mode syncs Lexical → XML live', () => {
  it('a suggestion typed in Suggesting mode reaches onLexicalChange as a ct-ins pair', async () => {
    const { editor, onLexicalChange } = await mount(PLAIN, 'suggesting');
    await run(editor, () => {
      const p = $getRoot().getChildren().find(n => n.getType() === 'paragraph') as ParagraphNode;
      const t = p.getFirstChild() as TextNode;
      t.select(12, 12);
      $insertTrackedText(t.select(12, 12), ' extra', MARK);
    });
    expect(lastXml(onLexicalChange)).toBe(PLAIN.replace(
      'One sentence body paragraph.',
      `One sentence<?ezd-review-start ${MARK.changeId}:ct-ins:${AUTHOR}:${Date.parse(MARK.date)}?> extra<?ezd-review-end ${MARK.changeId}?> body paragraph.`,
    ));
  });

  it('an XML-side (code) update while suggesting is still buffered, not parsed over the marks', async () => {
    const onLexicalChange = vi.fn<OnLexicalChange>();
    const onCarriedMarks = vi.fn<OnCarriedMarks>();
    const { rerender } = render(tree({ xml: PLAIN, mode: 'suggesting', onLexicalChange, onCarriedMarks }));
    await act(async () => { await new Promise(r => setTimeout(r, 250)); });
    const editor = editorRef!;
    await run(editor, () => {
      const p = $getRoot().getChildren().find(n => n.getType() === 'paragraph') as ParagraphNode;
      const t = p.getFirstChild() as TextNode;
      $insertTrackedText(t.select(12, 12), ' extra', MARK);
    });
    const withMark = editor.getEditorState().read(() => $getRoot().getTextContent());
    expect(withMark).toContain('One sentence extra body paragraph.');
    await act(async () => {
      rerender(tree({ xml: PLAIN.replace('One sentence', 'Another sentence'), mode: 'suggesting', lastUpdatedBy: 'code', onLexicalChange, onCarriedMarks }));
      await new Promise(r => setTimeout(r, 900));
    });
    expect(editor.getEditorState().read(() => $getRoot().getTextContent())).toBe(withMark);
  });
});

describe('review finding 1 — Accept All leaves the app with XML that has no review PI', () => {
  it('a split and an insert, then Accept All: the final XML equals the direct edit and carries no PI', async () => {
    const onLexicalChange = vi.fn<OnLexicalChange>();
    const onCarriedMarks = vi.fn<OnCarriedMarks>();
    const onAcceptAll = vi.fn<(tabId: string) => void>();
    const TWO = PLAIN.replace('<p>One sentence body paragraph.</p>', '<p>One sentence body paragraph.</p><p>Second paragraph with steady content.</p>');
    const { rerender } = render(tree({ xml: TWO, mode: 'suggesting', onLexicalChange, onCarriedMarks, onAcceptAll }));
    await act(async () => { await new Promise(r => setTimeout(r, 250)); });
    const editor = editorRef!;
    await run(editor, () => {
      const p = $getRoot().getChildren().filter(n => n.getType() === 'paragraph')[0] as ParagraphNode;
      const t = p.getFirstChild() as TextNode;
      $insertTrackedText(t.select(12, 12), ' extra', MARK);
    });
    await run(editor, () => {
      const p = $getRoot().getChildren().filter(n => n.getType() === 'paragraph')[1] as ParagraphNode;
      const t = p.getFirstChild() as TextNode;
      t.select(17, 17);
      $trackedParagraphSplit(t.select(17, 17));
    });
    expect(lastXml(onLexicalChange)).toContain('ct-split');
    await act(async () => {
      rerender(tree({ xml: lastXml(onLexicalChange)!, mode: 'suggesting', lastUpdatedBy: 'editor', acceptAllTrigger: 1, onLexicalChange, onCarriedMarks, onAcceptAll }));
      await new Promise(r => setTimeout(r, 300));
    });
    expect(onAcceptAll).toHaveBeenCalledWith('t');
    const final = lastXml(onLexicalChange)!;
    expect(final).not.toContain('ezd-review');
    expect(final).toBe(TWO.replace(
      '<p>One sentence body paragraph.</p><p>Second paragraph with steady content.</p>',
      '<p>One sentence extra body paragraph.</p><p>Second paragraph </p><p>with steady content.</p>',
    ));
  });
});

describe('ADR-015 decision 6 — a document that carries suggestions asks to open in Suggesting mode', () => {
  it('marks parsed from the XML in Editing mode are reported with their count', async () => {
    const { onCarriedMarks } = await mount(carrier('heretto-ct-del.dita'), 'editing');
    expect(onCarriedMarks).toHaveBeenCalledWith('t', 2);
  });

  it('a document without suggestions reports nothing', async () => {
    const { onCarriedMarks } = await mount(PLAIN, 'editing');
    expect(onCarriedMarks).not.toHaveBeenCalled();
  });

  it('a tab already in Suggesting mode is not asked again', async () => {
    const { onCarriedMarks } = await mount(carrier('heretto-ct-del.dita'), 'suggesting');
    expect(onCarriedMarks).not.toHaveBeenCalled();
  });
});

describe('ADR-015 decisions 3 and 8 — the change list for carried suggestions', () => {
  it('lists each carried mark with the author Heretto recorded, and an unmapped suggestion as unsupported', async () => {
    await mount(carrier('heretto-bold-wrap.dita'), 'suggesting');
    const p = panel();
    expect(p.getByText('Tracked changes (3)')).toBeInTheDocument();
    expect(p.getByText('Inserted')).toBeInTheDocument();
    expect(p.getByText('Deleted')).toBeInTheDocument();
    expect(p.getByText('Unsupported suggestion (ct-ins)')).toBeInTheDocument();
    expect(p.getAllByText(/author@example\.com/).length).toBe(3);
    // The unsupported row offers no Accept/Reject: two rows' worth of buttons only.
    expect(p.getAllByLabelText('Accept this change')).toHaveLength(2);
    expect(p.getAllByLabelText('Reject this change')).toHaveLength(2);
  });

  it('a replace carried from Heretto is two rows (Inserted, Deleted) sharing one changeId', async () => {
    await mount(carrier('heretto-replace-pair.dita'), 'suggesting');
    const p = panel();
    expect(p.getByText('Tracked changes (4)')).toBeInTheDocument();
    expect(p.getAllByText('Inserted')).toHaveLength(2);
    expect(p.getAllByText('Deleted')).toHaveLength(2);
    // Scoped to the panel: the same words are also live text in the editor.
    expect(p.getByText('sentence')).toBeInTheDocument();
    expect(p.getByText('paragraph')).toBeInTheDocument();
  });

  it('a comment is not listed at all', async () => {
    const xml = readFileSync(join(__dirname, 'sync/fixtures/sampled/topic/installation-codes.dita'), 'utf-8');
    await mount(xml, 'suggesting');
    expect(screen.queryByText(/Tracked changes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Unsupported suggestion/)).not.toBeInTheDocument();
  });
});
