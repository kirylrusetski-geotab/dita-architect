// @vitest-environment jsdom
//
// FR-063 — post-sync structural mismatch warning. Acceptance criteria 1–4:
//   1. a forced drop toasts; the normal path does not
//   2. no measurable latency (counts, not diffs) — measured over the corpus
//   3. zero false positives across the byte-stability corpus and real edits
//   4. advisory: the sync still completes and the XML pane gets the new XML
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, sep } from 'path';
import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getRoot,
  $isElementNode,
  $isTextNode,
  $createRangeSelection,
  $setSelection,
  type LexicalNode,
  type TextNode,
} from 'lexical';
import { $toggleLink } from '@lexical/link';
import { createTestEditor } from '../helpers/createTestEditor';
import { EDITOR_NODES } from '../../constants/editor-nodes';
import { parseXmlToLexical } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../../sync/nodeOriginMap';
import {
  checkSerializedStructure,
  describeMismatches,
  warnOnStructureMismatch,
  resetStructureWarningThrottle,
  type StructureMismatch,
} from '../../sync/structure-check';

const toastWarning = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { warning: toastWarning, success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

// Test-only hook (acceptance 1): when set, the serializer's output has every
// <xref> stripped to its text — the P1-13 failure mode, on demand.
const dropXrefs = vi.hoisted(() => ({ on: false }));
vi.mock('../../sync/serializeLexicalToXml', async importOriginal => {
  const real = await importOriginal<typeof import('../../sync/serializeLexicalToXml')>();
  return {
    ...real,
    serializeLexicalToXml: (...args: Parameters<typeof real.serializeLexicalToXml>) => {
      const xml = real.serializeLexicalToXml(...args);
      return dropXrefs.on ? xml.replace(/<xref\b[^>]*>([\s\S]*?)<\/xref>/g, '$1') : xml;
    },
  };
});

const FIXTURES_DIR = join(__dirname, 'fixtures');
const listFixtures = (dir: string, base: string = dir): string[] => {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) out.push(...listFixtures(f, base));
    else if (e.endsWith('.dita')) out.push(f.slice(base.length + 1).split(sep).join('/'));
  }
  return out.sort();
};

const DOC = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="s"><title>T</title><conbody>${body}</conbody></concept>`;

function findText(node: LexicalNode, needle: string): TextNode | null {
  if ($isTextNode(node) && node.getTextContent().includes(needle)) return node;
  if ($isElementNode(node)) for (const c of node.getChildren()) { const r = findText(c, needle); if (r) return r; }
  return null;
}
function $selectWord(needle: string) {
  const t = findText($getRoot(), needle);
  if (!t) throw new Error(`no "${needle}"`);
  const s = t.getTextContent().indexOf(needle);
  const sel = $createRangeSelection();
  sel.anchor.set(t.getKey(), s, 'text');
  sel.focus.set(t.getKey(), s + needle.length, 'text');
  $setSelection(sel);
}

/** Parse, optionally edit, serialize, check. */
function run(xml: string, edit?: () => void): { out: string; mismatches: StructureMismatch[] } {
  const editor = createTestEditor();
  const originMap = createNodeOriginMap();
  const cache = createXmlMetaCache();
  parseXmlToLexical(xml, editor, originMap, true);
  if (edit) editor.update(edit, { discrete: true });
  const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
  return { out, mismatches: checkSerializedStructure(editor.getEditorState(), out, originMap) };
}

beforeEach(() => {
  dropXrefs.on = false;
  toastWarning.mockClear();
  resetStructureWarningThrottle();
});

// ─── 3. Zero false positives ─────────────────────────────────────────────────

// A byte-stable fixture must produce no warning at all. A fixture that already
// fails byte-stability (BUG-28/29/30/31) may produce a warning, but only a
// TRUE one: checked against the SOURCE XML, the editor must not hold more of
// anything than the source did, so whatever the output lacks is genuinely
// lost. (FR-063's first run found exactly that: the two BUG-28 fixtures lose
// every <ul> on a round trip, while the editor still shows them.)
describe('FR-063 acceptance 3 — zero false positives over the byte-stability corpus', () => {
  const fixtures = listFixtures(FIXTURES_DIR);
  const normalize = (x: string) => x.replace(/\s+$/, '');
  const fmt = (ms: StructureMismatch[]) => ms.map(m => `${m.key}: editor ${m.editorCount}, xml ${m.xmlCount}`).join('; ');
  it('the corpus is non-empty', () => expect(fixtures.length).toBeGreaterThan(40));
  for (const rel of fixtures) {
    it(`${rel} — no false warning on an unedited round trip`, () => {
      const xml = readFileSync(join(FIXTURES_DIR, rel), 'utf-8');
      const editor = createTestEditor();
      const originMap = createNodeOriginMap();
      parseXmlToLexical(xml, editor, originMap, true);
      const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
      const mismatches = checkSerializedStructure(editor.getEditorState(), out, originMap);
      if (normalize(out) === normalize(xml)) {
        expect(mismatches, fmt(mismatches)).toEqual([]);
      } else {
        const againstSource = checkSerializedStructure(editor.getEditorState(), xml, originMap);
        expect(againstSource, `editor holds more than the source: ${fmt(againstSource)}`).toEqual([]);
      }
    });
  }

  it('the two fixtures FR-063 first caught losing every list (BUG-28) now report nothing', () => {
    // FR-063's first corpus run (v0.10.0) reported list 3 > 0 for both; ADR-011
    // (v0.10.1) fixed the loss. Kept as a guard: if they ever warn again, the
    // section identity work has regressed.
    for (const rel of ['sampled/topic/altitude-api-reuse.dita', 'sampled/reference/j1939-ev-mandatory-signals.dita']) {
      const { mismatches } = run(readFileSync(join(FIXTURES_DIR, rel), 'utf-8'));
      expect(mismatches, rel).toEqual([]);
    }
  });
});

describe('FR-063 acceptance 3 — zero false positives on real edits', () => {
  const para = '<p>Open the Settings page, choose <menucascade><uicontrol>File</uicontrol><uicontrol>Save</uicontrol></menucascade>, and see <ph keyref="prod" outputclass="x"/> now. <!-- c --> Done.</p>';

  it('Insert Link beside a menucascade, a chip, and a comment', () => {
    const { out, mismatches } = run(DOC(para), () => { $selectWord('Settings'); $toggleLink('other.dita'); });
    expect(out).toContain('<xref href="other.dita" format="dita">Settings</xref>');
    expect(mismatches).toEqual([]);
  });

  it('deleting a link (editor and XML both lose it) is not a mismatch', () => {
    const xml = DOC('<p>See <xref href="a.dita" format="dita">a</xref> and <xref href="b.dita" format="dita">b</xref>.</p>');
    const { out, mismatches } = run(xml, () => {
      const t = findText($getRoot(), 'b');
      t?.getParent()?.remove();
    });
    expect(out).not.toContain('b.dita');
    expect(mismatches).toEqual([]);
  });

  it('deleting a whole note is not a mismatch', () => {
    const xml = DOC('<p>Keep.</p><note type="tip">Remove me.</note>');
    const { out, mismatches } = run(xml, () => {
      $getRoot().getChildren().find(n => n.getType() === 'quote')?.remove();
    });
    expect(out).not.toContain('<note');
    expect(mismatches).toEqual([]);
  });
});

// ─── 1. A forced drop toasts ─────────────────────────────────────────────────

describe('FR-063 acceptance 1 — a dropped element is reported', () => {
  it('a link the serializer drops is reported with the P1-13 copy', () => {
    dropXrefs.on = true;
    const { out, mismatches } = run(DOC('<p>Click our website for details.</p>'), () => {
      $selectWord('our website');
      $toggleLink('https://example.com');
    });
    expect(out).not.toContain('<xref');
    expect(mismatches).toEqual([
      { key: 'xref', noun: { one: 'link', many: 'links' }, xmlName: '<xref>', editorCount: 1, xmlCount: 0 },
    ]);
    expect(describeMismatches(mismatches)).toBe(
      '1 link in the visual editor has no matching <xref> in the XML. Check the source pane.'
    );
  });

  it('a dropped inline element and a dropped note are each named', () => {
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const xml = DOC('<p>Click <uicontrol>Save</uicontrol> and <uicontrol>Close</uicontrol>.</p><note>Careful.</note>');
    parseXmlToLexical(xml, editor, originMap, true);
    const stripped = xml.replace(/<\/?uicontrol>/g, '').replace(/<note>Careful.<\/note>/, '');
    const mismatches = checkSerializedStructure(editor.getEditorState(), stripped, originMap);
    expect(mismatches.map(m => [m.key, m.editorCount, m.xmlCount])).toEqual([
      ['inline:uicontrol', 2, 0],
      ['note', 1, 0],
    ]);
    expect(describeMismatches(mismatches)).toBe(
      '2 <uicontrol> elements in the visual editor have no matching <uicontrol> in the XML. Check the source pane. 1 other element type differs too.'
    );
  });

  it('a dropped conkeyref chip is reported by its attribute', () => {
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const xml = DOC('<p>Use <ph conkeyref="vars/Prod"/> here.</p>');
    parseXmlToLexical(xml, editor, originMap, true);
    const mismatches = checkSerializedStructure(editor.getEditorState(), xml.replace('<ph conkeyref="vars/Prod"/>', ''), originMap);
    expect(describeMismatches(mismatches)).toBe(
      '1 conkeyref reference in the visual editor has no matching element with conkeyref in the XML. Check the source pane.'
    );
  });

  it('markup inside a comment is not counted as structure', () => {
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const xml = DOC('<p>Click <xref href="a.dita" format="dita">a</xref>.</p>');
    parseXmlToLexical(xml, editor, originMap, true);
    const commented = xml.replace(/<xref[^>]*>a<\/xref>/, '<!-- <xref href="a.dita">a</xref> -->a');
    expect(checkSerializedStructure(editor.getEditorState(), commented, originMap).map(m => m.key)).toEqual(['xref']);
  });
});

describe('FR-063 — warnOnStructureMismatch: one toast, throttled, never throws', () => {
  it('toasts once for a mismatch and stays quiet for the same message inside the window', () => {
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const xml = DOC('<p>See <xref href="a.dita" format="dita">a</xref>.</p>');
    parseXmlToLexical(xml, editor, originMap, true);
    const dropped = xml.replace(/<xref[^>]*>a<\/xref>/, 'a');
    warnOnStructureMismatch(editor.getEditorState(), dropped, originMap);
    warnOnStructureMismatch(editor.getEditorState(), dropped, originMap);
    expect(toastWarning).toHaveBeenCalledTimes(1);
    expect(toastWarning).toHaveBeenCalledWith('1 link in the visual editor has no matching <xref> in the XML. Check the source pane.');
  });

  it('no toast when the structure matches', () => {
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const xml = DOC('<p>See <xref href="a.dita" format="dita">a</xref>.</p>');
    parseXmlToLexical(xml, editor, originMap, true);
    expect(warnOnStructureMismatch(editor.getEditorState(), xml, originMap)).toEqual([]);
    expect(toastWarning).not.toHaveBeenCalled();
  });

  it('a failure inside the check is swallowed (advisory)', () => {
    const throwing = { read: () => { throw new Error('boom'); } };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(warnOnStructureMismatch(throwing, '<x/>', createNodeOriginMap())).toEqual([]);
    expect(toastWarning).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

// ─── 2. Latency ──────────────────────────────────────────────────────────────

describe('FR-063 acceptance 2 — counts, not diffs: cost per sync', () => {
  it('the check over the whole corpus costs a small fraction of the serialize itself', () => {
    const fixtures = listFixtures(FIXTURES_DIR);
    let serializeMs = 0;
    let checkMs = 0;
    for (const rel of fixtures) {
      const xml = readFileSync(join(FIXTURES_DIR, rel), 'utf-8');
      const editor = createTestEditor();
      const originMap = createNodeOriginMap();
      parseXmlToLexical(xml, editor, originMap, true);
      const t0 = performance.now();
      const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
      const t1 = performance.now();
      checkSerializedStructure(editor.getEditorState(), out, originMap);
      const t2 = performance.now();
      serializeMs += t1 - t0;
      checkMs += t2 - t1;
    }
    console.log(`[FR-063] ${fixtures.length} fixtures: serialize ${serializeMs.toFixed(1)} ms, check ${checkMs.toFixed(1)} ms (${(checkMs / fixtures.length).toFixed(2)} ms per sync)`);
    // Loose bound so the test is not timing-flaky: the check must not cost
    // more than the serialize it rides on.
    expect(checkMs).toBeLessThan(Math.max(serializeMs, 50));
  });
});

// ─── 4. Advisory, through the real SyncManager ───────────────────────────────

describe('FR-063 acceptance 4 — through SyncManager: the toast fires and the sync still completes', () => {
  it('a visual-editor link the serializer drops is warned about, even though the XML did not change', async () => {
    const { SyncManager } = await import('../../components/SyncManager');
    const xml = DOC('<p>Click our website for details.</p>');
    const onLexicalChange = vi.fn();

    const EditPlugin = () => {
      const [editor] = useLexicalComposerContext();
      useEffect(() => {
        // After SyncManager's mount parse has committed, make a visual edit.
        const id = setTimeout(() => {
          editor.update(() => { $selectWord('our website'); $toggleLink('https://example.com'); });
        }, 250);
        return () => clearTimeout(id);
      }, [editor]);
      return null;
    };

    dropXrefs.on = true;
    render(
      <LexicalComposer initialConfig={{ namespace: 'fr063', nodes: EDITOR_NODES, onError: (e: Error) => { throw e; }, theme: {} }}>
        <SyncManager xmlContent={xml} onLexicalChange={onLexicalChange} lastUpdatedBy="code">
          {/* Lexical commits updates only with a mounted root element. */}
          <RichTextPlugin contentEditable={<ContentEditable />} placeholder={null} ErrorBoundary={LexicalErrorBoundary} />
          <EditPlugin />
        </SyncManager>
      </LexicalComposer>
    );
    await act(async () => { await new Promise(r => setTimeout(r, 600)); });

    // The drop left the XML byte-identical to what the pane already had, so
    // SyncManager correctly does not re-emit it — the P1-13 shape exactly. The
    // warning must fire anyway; that is the whole point of FR-063.
    expect(onLexicalChange).not.toHaveBeenCalled();
    expect(toastWarning).toHaveBeenCalledWith('1 link in the visual editor has no matching <xref> in the XML. Check the source pane.');
  });

  it('the normal path (no drop): the sync emits the <xref> and no warning fires', async () => {
    const { SyncManager } = await import('../../components/SyncManager');
    const xml = DOC('<p>Click our website for details.</p>');
    const onLexicalChange = vi.fn();
    const EditPlugin = () => {
      const [editor] = useLexicalComposerContext();
      useEffect(() => {
        const id = setTimeout(() => {
          editor.update(() => { $selectWord('our website'); $toggleLink('https://example.com'); });
        }, 250);
        return () => clearTimeout(id);
      }, [editor]);
      return null;
    };
    render(
      <LexicalComposer initialConfig={{ namespace: 'fr063b', nodes: EDITOR_NODES, onError: (e: Error) => { throw e; }, theme: {} }}>
        <SyncManager xmlContent={xml} onLexicalChange={onLexicalChange} lastUpdatedBy="code">
          <RichTextPlugin contentEditable={<ContentEditable />} placeholder={null} ErrorBoundary={LexicalErrorBoundary} />
          <EditPlugin />
        </SyncManager>
      </LexicalComposer>
    );
    await act(async () => { await new Promise(r => setTimeout(r, 600)); });
    expect(onLexicalChange).toHaveBeenCalled();
    const synced = onLexicalChange.mock.calls[onLexicalChange.mock.calls.length - 1][0] as string;
    expect(synced).toContain('<xref href="https://example.com" format="html">our website</xref>');
    expect(toastWarning).not.toHaveBeenCalled();
  });
});
