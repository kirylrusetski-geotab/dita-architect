// @vitest-environment jsdom
//
// ADR-010 slice A — the inline reconciler. Invariants R1–R6 from the ADR, each
// pinned here BEFORE the reconciler existed (Execution Plan Session 2A).
//
// The reconciler replaces "decide whether the element changed, then rewrite
// all of it" with "keep every inline element that still matches, rewrite only
// the changed run". Unchanged siblings must come out byte-identical; that is
// what every expectation below checks with full-string equality, not
// toContain.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, sep } from 'path';
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
import { createTestEditor, roundTrip } from '../helpers/createTestEditor';
import { parseXmlToLexical } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../../sync/nodeOriginMap';
import { setReconcileObserver, type ReconcileReport } from '../../sync/inline-reconcile';

const FIXTURES_DIR = join(__dirname, 'fixtures');

function listFixtures(dir: string, base: string = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFixtures(full, base));
    else if (entry.endsWith('.dita')) out.push(full.slice(base.length + 1).split(sep).join('/'));
  }
  return out.sort();
}

const DOC = (body: string, root: 'concept' | 'task' = 'concept'): string => {
  const bodyTag = root === 'concept' ? 'conbody' : 'taskbody';
  const dtd = root === 'concept'
    ? '<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">'
    : '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">';
  return `<?xml version="1.0" encoding="UTF-8"?>\n${dtd}\n<${root} id="r"><title>T</title><${bodyTag}>${body}</${bodyTag}></${root}>`;
};

function findText(node: LexicalNode, needle: string): TextNode | null {
  if ($isTextNode(node) && node.getTextContent().includes(needle)) return node;
  if ($isElementNode(node)) {
    for (const c of node.getChildren()) {
      const r = findText(c, needle);
      if (r) return r;
    }
  }
  return null;
}

/** Parse, run `edit` inside one discrete update, serialize against the source. */
function editAndSerialize(xml: string, edit: () => void): string {
  const editor = createTestEditor();
  const originMap = createNodeOriginMap();
  const cache = createXmlMetaCache();
  parseXmlToLexical(xml, editor, originMap, true);
  editor.update(edit, { discrete: true });
  return serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
}

/** Select `needle` inside the text node that contains it. */
function selectWord(needle: string): void {
  const t = findText($getRoot(), needle);
  if (!t) throw new Error(`no text node contains "${needle}"`);
  const s = t.getTextContent().indexOf(needle);
  const sel = $createRangeSelection();
  sel.anchor.set(t.getKey(), s, 'text');
  sel.focus.set(t.getKey(), s + needle.length, 'text');
  $setSelection(sel);
}

/** Simulate the v0.10.0 wrap: split, token mode, inlineTag stamp (M1's parse shape). */
function stampWrap(originMap: Map<string, any>, needle: string, tag: string): void {
  const t = findText($getRoot(), needle);
  if (!t) throw new Error(`no text node contains "${needle}"`);
  const s = t.getTextContent().indexOf(needle);
  const parts = t.splitText(s, s + needle.length);
  const mid = parts.find(p => p.getTextContent() === needle);
  if (!mid) throw new Error('split did not isolate the needle');
  mid.setMode('token');
  if (tag === 'uicontrol') mid.toggleFormat('bold');
  originMap.set(mid.getKey(), { tag, bodyIndex: -1, inlineTag: tag });
}

// ─── R1 ──────────────────────────────────────────────────────────────────────

describe('ADR-010 R1 — no false rewrites: every corpus element is untouched on an unedited parse', () => {
  const reports: ReconcileReport[] = [];
  beforeEach(() => { reports.length = 0; setReconcileObserver(r => reports.push(r)); });
  afterEach(() => setReconcileObserver(null));

  const fixtures = listFixtures(FIXTURES_DIR);

  it('the corpus is non-empty', () => {
    expect(fixtures.length).toBeGreaterThan(40);
  });

  // A fixture that is byte-stable today must see zero 'patched' decisions: any
  // one would be a false rewrite. A fixture that already fails byte-stability
  // (a KNOWN_FAILURES entry in byte-stability.test.ts — BUG-28/29/30/31) has a
  // Lexical tree that genuinely differs from its source, so the reconciler
  // patching there reflects the filed parser bug, not a reconciler fault; for
  // those only drift is asserted. The condition is computed, not listed, so the
  // assertion tightens by itself as those bugs are fixed.
  const normalize = (xml: string) => xml.replace(/\s+$/, '');
  for (const rel of fixtures) {
    it(`${rel} — zero false rewrites, zero drift bails`, () => {
      const xml = readFileSync(join(FIXTURES_DIR, rel), 'utf-8');
      const stableToday = normalize(roundTrip(xml)) === normalize(xml);
      const patched = reports.filter(r => r.status === 'patched');
      const drift = reports.filter(r => r.status === 'bail' && r.reason === 'drift');
      if (stableToday) {
        expect(patched, `patched elements: ${patched.map(r => `${r.tag}: ${r.detail ?? ''}`).join(' | ')}`).toEqual([]);
      }
      expect(drift, `drift bails: ${drift.map(r => `${r.tag}: ${r.detail ?? ''}`).join(' | ')}`).toEqual([]);
    });
  }

  it('the reconciler actually ran over the corpus (the seam is live, not vacuous)', () => {
    let untouched = 0;
    for (const rel of fixtures) {
      reports.length = 0;
      roundTrip(readFileSync(join(FIXTURES_DIR, rel), 'utf-8'));
      untouched += reports.filter(r => r.status === 'untouched').length;
    }
    expect(untouched).toBeGreaterThan(100);
  });
});

// ─── R3 — BUG-32 ─────────────────────────────────────────────────────────────

describe('ADR-010 R3 — BUG-32: Insert Link leaves sibling <menucascade> and chip attributes byte-identical', () => {
  const para = '<p>Open the Settings page, choose <menucascade><uicontrol>File</uicontrol><uicontrol>Save</uicontrol></menucascade>, and see <ph keyref="prod" outputclass="x"/> now.</p>';
  const xml = DOC(para);

  it('$toggleLink on "Settings" (the shipping Insert Link command)', () => {
    const out = editAndSerialize(xml, () => {
      selectWord('Settings');
      $toggleLink('other.dita');
    });
    const expected = xml.replace('Open the Settings page', 'Open the <xref href="other.dita" format="dita">Settings</xref> page');
    expect(out).toBe(expected);
  });

  it('link inside a <cmd> beside an existing <uicontrol class> keeps the uicontrol and its class', () => {
    const task = DOC('<steps><step><cmd>Click <uicontrol class="+ topic/ph ui-d/uicontrol ">Save</uicontrol> then read the guide.</cmd></step></steps>', 'task');
    const out = editAndSerialize(task, () => {
      selectWord('guide');
      $toggleLink('https://example.com/guide');
    });
    const expected = task.replace('read the guide.', 'read the <xref href="https://example.com/guide" format="html">guide</xref>.');
    expect(out).toBe(expected);
  });
});

// ─── R4 — BUG-33 ─────────────────────────────────────────────────────────────

describe('ADR-010 R4 — BUG-33: a structure-only edit in an element holding a comment is emitted, comment kept', () => {
  it('link added to a paragraph with an XML comment', () => {
    const xml = DOC('<p>Open the Settings page <!-- reviewer: check --> and continue.</p>');
    const out = editAndSerialize(xml, () => {
      selectWord('Settings');
      $toggleLink('settings.dita');
    });
    const expected = xml.replace('Open the Settings page', 'Open the <xref href="settings.dita" format="dita">Settings</xref> page');
    expect(out).toBe(expected);
  });

  it('text typed in a paragraph with a Heretto review PI keeps the PI in place', () => {
    const xml = DOC('<p>Alpha <?ezd-review-start 1:ct-ins:a@example.com:1?>beta<?ezd-review-end 1?> gamma.</p>');
    const out = editAndSerialize(xml, () => {
      const t = findText($getRoot(), 'gamma');
      if (!t) throw new Error('no gamma');
      t.setTextContent(t.getTextContent().replace('gamma.', 'gamma delta.'));
    });
    expect(out).toBe(xml.replace('gamma.', 'gamma delta.'));
  });
});

// ─── R5 — type then wrap ─────────────────────────────────────────────────────

describe('ADR-010 R5 — typed text and a stamped wrap in the same element both reach the XML', () => {
  it('type a phrase, wrap one word of it in <uicontrol>', () => {
    const xml = DOC('<p>Open the Settings page, choose <menucascade><uicontrol>File</uicontrol><uicontrol>Save</uicontrol></menucascade>, and see <ph keyref="prod" outputclass="x"/> now.</p>');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.update(() => {
      const t = findText($getRoot(), 'Settings');
      if (!t) throw new Error('no Settings');
      t.setTextContent(t.getTextContent().replace('Open the Settings page', 'Open the Settings page and the Advanced tab'));
    }, { discrete: true });
    editor.update(() => stampWrap(originMap, 'Advanced', 'uicontrol'), { discrete: true });
    const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
    const expected = xml.replace('Open the Settings page', 'Open the Settings page and the <uicontrol>Advanced</uicontrol> tab');
    expect(out).toBe(expected);
  });

  it('a stamped wrap alone, inside a <cmd>, is emitted (the probe that started ADR-010)', () => {
    const xml = DOC('<steps><step><cmd>Click the Save button here.</cmd></step></steps>', 'task');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.update(() => stampWrap(originMap, 'Save', 'uicontrol'), { discrete: true });
    const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
    expect(out).toBe(xml.replace('the Save button', 'the <uicontrol>Save</uicontrol> button'));
  });

  it('formatting whitespace around the element content is preserved through a splice', () => {
    const xml = DOC('<p>\n      Click Save <b>now</b>, please.\n    </p>');
    const out = editAndSerialize(xml, () => {
      selectWord('Save');
      $toggleLink('save.dita');
    });
    expect(out).toBe(xml.replace('Click Save <b>', 'Click <xref href="save.dita" format="dita">Save</xref> <b>'));
  });
});

// ─── R6 — edit inside an existing element ────────────────────────────────────

describe('ADR-010 R6 — a text edit inside an inline element keeps one element with its attributes', () => {
  it('append a word inside <uicontrol class="…">', () => {
    const xml = DOC('<p>Click <uicontrol class="+ topic/ph ui-d/uicontrol ">Save</uicontrol> to finish.</p>');
    const out = editAndSerialize(xml, () => {
      const t = findText($getRoot(), 'Save');
      if (!t) throw new Error('no Save');
      t.setTextContent('Save now');
    });
    expect(out).toBe(xml.replace('>Save</uicontrol>', '>Save now</uicontrol>'));
  });

  it('bold toggle beside a <ph conkeyref> chip: the toggle lands and the ref is untouched (S2 bail retired)', () => {
    const xml = DOC('<p>See <ph conkeyref="vars/Product"/> and more text.</p>');
    const out = editAndSerialize(xml, () => {
      const t = findText($getRoot(), 'more');
      if (!t) throw new Error('no more');
      const s = t.getTextContent().indexOf('more');
      const parts = t.splitText(s, s + 4);
      const mid = parts.find(p => p.getTextContent() === 'more');
      if (!mid) throw new Error('split failed');
      mid.toggleFormat('bold');
    });
    expect(out).toBe(xml.replace('and more text', 'and <b>more</b> text'));
  });
});

// ─── Bail cases — the legacy path, loudly ────────────────────────────────────

describe('ADR-010 — bail cases fall to the legacy path and are reported', () => {
  const reports: ReconcileReport[] = [];
  beforeEach(() => { reports.length = 0; setReconcileObserver(r => reports.push(r)); });
  afterEach(() => setReconcileObserver(null));

  it('a deletion that spans a processing instruction bails (never silently drops the PI)', () => {
    const xml = DOC('<p>Alpha <?ezd-review-start 1:ct-ins:a@example.com:1?>beta<?ezd-review-end 1?> gamma.</p>');
    editAndSerialize(xml, () => {
      const t = findText($getRoot(), 'beta');
      if (!t) throw new Error('no beta');
      // The parse merged "Alpha ", "beta", " gamma." into one text node; delete across the PI.
      t.setTextContent(t.getTextContent().replace('Alpha beta gamma.', 'Alpha gamma.'));
    });
    const bails = reports.filter(r => r.status === 'bail');
    expect(bails.length).toBeGreaterThan(0);
    expect(bails[0].reason).toBe('fixed-inside');
  });
});
