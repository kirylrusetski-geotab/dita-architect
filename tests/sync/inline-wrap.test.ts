// @vitest-environment jsdom
//
// ADR-010 slice B — wrap selected text in an inline element, and unwrap it.
// Invariants I1–I7 from the Execution Plan (Session 2B), written before the
// implementation. Every serialization check is full-string equality against
// the PRE-WRAP serialization, so "no other byte changed" is what is asserted.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isElementNode,
  $isTextNode,
  $createRangeSelection,
  $setSelection,
  UNDO_COMMAND,
  REDO_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  type TextNode,
} from 'lexical';
import { $isLinkNode } from '@lexical/link';
import { registerHistory, createEmptyHistoryState } from '@lexical/history';
import { createTestEditor } from '../helpers/createTestEditor';
import { parseXmlToLexical } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap, type NodeOriginMapType } from '../../sync/nodeOriginMap';
import {
  WRAP_TAGS,
  $wrapSelectionInInlineTag,
  $unwrapInlineAtSelection,
  type WrapTag,
} from '../../lib/inline-wrap';

const FIXTURES = join(__dirname, 'fixtures');
const fixture = (name: string) => readFileSync(join(FIXTURES, name), 'utf-8');

interface Harness {
  editor: LexicalEditor;
  originMap: NodeOriginMapType;
  xml: string;
  serialize: () => string;
}

const open = (xml: string): Harness => {
  const editor = createTestEditor();
  const originMap = createNodeOriginMap();
  const cache = createXmlMetaCache();
  parseXmlToLexical(xml, editor, originMap, true);
  return { editor, originMap, xml, serialize: () => serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache) };
};

function findPlainText(node: LexicalNode, needle: string): TextNode | null {
  if ($isTextNode(node) && node.getTextContent().includes(needle)) return node;
  if ($isElementNode(node)) for (const c of node.getChildren()) { const r = findPlainText(c, needle); if (r) return r; }
  return null;
}

/** Select `needle` inside the one text node that holds it. */
function $select(needle: string): void {
  const t = findPlainText($getRoot(), needle);
  if (!t) throw new Error(`no text node holds "${needle}"`);
  const s = t.getTextContent().indexOf(needle);
  const sel = $createRangeSelection();
  sel.anchor.set(t.getKey(), s, 'text');
  sel.focus.set(t.getKey(), s + needle.length, 'text');
  $setSelection(sel);
}

/** Place a collapsed caret inside `needle`. */
function $caretIn(needle: string): void {
  const t = findPlainText($getRoot(), needle);
  if (!t) throw new Error(`no text node holds "${needle}"`);
  const s = t.getTextContent().indexOf(needle) + 1;
  const sel = $createRangeSelection();
  sel.anchor.set(t.getKey(), s, 'text');
  sel.focus.set(t.getKey(), s, 'text');
  $setSelection(sel);
}

const occurrences = (hay: string, needle: string) => hay.split(needle).length - 1;

// The test editor is not headless and has no mounted root, so Lexical rebuilds
// each update's selection from the (absent) DOM selection: a selection set in
// one update does not survive into the next. In the app the DOM selection
// persists, so every multi-update test re-selects what the author would still
// have selected (the wrapped text, per I3) before acting on it.
const $reselect = (needle: string) => $select(needle);

/** The expected element for a wrap, as the serializer writes it. */
const wrapped = (tag: WrapTag, text: string): string =>
  tag === 'xref' ? `<xref href="target.dita" format="dita" scope="local">${text}</xref>` : `<${tag}>${text}</${tag}>`;

const wrapAttrs = (tag: WrapTag) => (tag === 'xref' ? { href: 'target.dita', format: 'dita', scope: 'local' } : undefined);

// ─── I1 + I2 across every context ────────────────────────────────────────────

// [fixture, context, needle]. Each needle occurs exactly once in its fixture
// (asserted below), inside plain text of the named context.
const CONTEXTS: Array<[string, string, string]> = [
  ['inline-contexts.dita', 'shortdesc', 'read'],
  ['inline-contexts.dita', 'body <p>', 'define'],
  ['inline-contexts.dita', '<li> direct text', 'Each'],
  ['inline-contexts.dita', '<note> direct text', 'Press'],
  ['inline-contexts.dita', '<entry> direct text', 'or run'],
  ['inline-contexts.dita', '<entry><p>', 'The'],
  ['inline-contexts.dita', '<dd><p>', 'Choose'],
  ['inline-contexts.dita', '<section><p>', 'Select'],
  ['inline-contexts-trouble.dita', '<condition><p>', 'column'],
  ['inline-contexts-trouble.dita', '<cause><p>', 'flag'],
  ['inline-contexts-trouble.dita', '<cause><note>', 'Check'],
  ['inline-contexts-trouble.dita', '<remedy> <cmd>', 'clear'],
  ['troubleshooting-rich.dita', '<p> wrapping a <ul> (BUG-25 segment)', 'has no'],
];

describe('I1/I2 — wrap emits exactly <tag>text</tag>; unwrap restores the pre-wrap bytes', () => {
  for (const [file, context, needle] of CONTEXTS) {
    it(`${context}: "${needle}" occurs exactly once in ${file}`, () => {
      expect(occurrences(fixture(file), needle)).toBe(1);
    });
    for (const tag of WRAP_TAGS) {
      it(`${context}: wrap "${needle}" in <${tag}>, then unwrap`, () => {
        const h = open(fixture(file));
        const before = h.serialize();
        let result: ReturnType<typeof $wrapSelectionInInlineTag> | undefined;
        h.editor.update(() => { $select(needle); result = $wrapSelectionInInlineTag(tag, h.originMap, wrapAttrs(tag)); }, { discrete: true });
        expect(result).toEqual({ status: 'ok' });
        const after = h.serialize();
        expect(after).toBe(before.replace(needle, wrapped(tag, needle)));

        let unwrap: ReturnType<typeof $unwrapInlineAtSelection> | undefined;
        h.editor.update(() => { $reselect(needle); unwrap = $unwrapInlineAtSelection(h.originMap); }, { discrete: true });
        expect(unwrap).toEqual({ status: 'ok' });
        expect(h.serialize()).toBe(before);
      });
    }
  }
});

// ─── I3 — selection covers the new element ───────────────────────────────────

describe('I3 — after a wrap the selection covers exactly the new element', () => {
  for (const tag of WRAP_TAGS) {
    it(`<${tag}>`, () => {
      const h = open(fixture('inline-contexts.dita'));
      h.editor.update(() => { $select('define'); $wrapSelectionInInlineTag(tag, h.originMap, wrapAttrs(tag)); }, { discrete: true });
      h.editor.getEditorState().read(() => {
        const sel = $getSelection();
        expect($isRangeSelection(sel)).toBe(true);
        if (!$isRangeSelection(sel)) return;
        expect(sel.getTextContent()).toBe('define');
        const anchor = sel.anchor.getNode();
        const focus = sel.focus.getNode();
        expect(anchor.getKey()).toBe(focus.getKey());
        expect(anchor.getTextContent()).toBe('define');
        if (tag === 'xref') expect($isLinkNode(anchor.getParent())).toBe(true);
        else if (tag === 'codeph') expect((anchor as TextNode).hasFormat('code')).toBe(true);
        else expect(h.originMap.get(anchor.getKey())?.inlineTag).toBe(tag);
      });
    });
  }

  it('after an unwrap the selection still covers the same text', () => {
    const h = open(fixture('inline-contexts.dita'));
    h.editor.update(() => { $select('define'); $wrapSelectionInInlineTag('uicontrol', h.originMap); }, { discrete: true });
    h.editor.update(() => { $reselect('define'); $unwrapInlineAtSelection(h.originMap); }, { discrete: true });
    h.editor.getEditorState().read(() => {
      const sel = $getSelection();
      expect($isRangeSelection(sel) && sel.getTextContent()).toBe('define');
    });
  });
});

// ─── I4 — existing siblings are byte-identical ───────────────────────────────

describe('I4 — existing inline elements in the paragraph stay byte-identical', () => {
  const para = '<p>Open the Settings page, choose <menucascade><uicontrol>File</uicontrol><uicontrol>Save</uicontrol></menucascade>, then <ph conkeyref="vars/Prod" outputclass="x"/> and <uicontrol class="+ topic/ph ui-d/uicontrol ">OK</uicontrol>.</p>';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="i4"><title>T</title><conbody>${para}</conbody></concept>`;
  for (const tag of WRAP_TAGS) {
    it(`<${tag}> wrap beside menucascade, a chip with outputclass, and a classed uicontrol`, () => {
      const h = open(xml);
      h.editor.update(() => { $select('Settings'); $wrapSelectionInInlineTag(tag, h.originMap, wrapAttrs(tag)); }, { discrete: true });
      expect(h.serialize()).toBe(xml.replace('Settings', wrapped(tag, 'Settings')));
    });
  }
});

// ─── I5 — xref attributes exactly as entered ─────────────────────────────────

describe('I5 — an <xref> wrap writes href, format, and scope exactly as entered', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="i5"><title>T</title><conbody><p>Read the guide first.</p></conbody></concept>`;
  const cases: Array<[string, { href: string; format?: string; scope?: string }, string]> = [
    ['all three', { href: 'guide.dita#guide/intro', format: 'dita', scope: 'peer' }, '<xref href="guide.dita#guide/intro" format="dita" scope="peer">guide</xref>'],
    ['external with format html', { href: 'https://example.com/g', format: 'html', scope: 'external' }, '<xref href="https://example.com/g" format="html" scope="external">guide</xref>'],
    ['href only: format inferred, no scope', { href: 'https://example.com/g' }, '<xref href="https://example.com/g" format="html">guide</xref>'],
    ['scope only: format inferred from href', { href: 'g.dita', scope: 'local' }, '<xref href="g.dita" format="dita" scope="local">guide</xref>'],
  ];
  for (const [label, attrs, expected] of cases) {
    it(label, () => {
      const h = open(xml);
      h.editor.update(() => { $select('guide'); $wrapSelectionInInlineTag('xref', h.originMap, attrs); }, { discrete: true });
      expect(h.serialize()).toBe(xml.replace('guide', expected));
    });
  }

  it('an xref wrap without an href is refused', () => {
    const h = open(xml);
    let r: ReturnType<typeof $wrapSelectionInInlineTag> | undefined;
    h.editor.update(() => { $select('guide'); r = $wrapSelectionInInlineTag('xref', h.originMap, { href: '  ' }); }, { discrete: true });
    expect(r).toEqual({ status: 'refused', reason: 'no-href' });
    expect(h.serialize()).toBe(xml);
  });
});

// ─── Refusals ────────────────────────────────────────────────────────────────

describe('refusals leave the document untouched', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="rf"><title>T</title><conbody><p>Click <uicontrol>Save</uicontrol> then <b>bold</b> and <ph conkeyref="v/P"/> here.</p><p>Second paragraph.</p></conbody></concept>`;

  const refuse = (setup: () => void, reason: string) => {
    const h = open(xml);
    const before = h.serialize();
    let r: ReturnType<typeof $wrapSelectionInInlineTag> | undefined;
    h.editor.update(() => { setup(); r = $wrapSelectionInInlineTag('uicontrol', h.originMap); }, { discrete: true });
    expect(r).toEqual({ status: 'refused', reason });
    expect(h.serialize()).toBe(before);
  };

  it('collapsed selection', () => refuse(() => $caretIn('Click'), 'collapsed'));
  it('selection across two paragraphs', () => refuse(() => {
    const a = findPlainText($getRoot(), ' here.');
    const b = findPlainText($getRoot(), 'Second');
    if (!a || !b) throw new Error('setup');
    const sel = $createRangeSelection();
    sel.anchor.set(a.getKey(), 2, 'text');
    sel.focus.set(b.getKey(), 3, 'text');
    $setSelection(sel);
  }, 'cross-block'));
  it('selection inside an existing <uicontrol>', () => refuse(() => $select('Save'), 'overlap'));
  it('selection spanning an existing <uicontrol>', () => refuse(() => {
    const a = findPlainText($getRoot(), 'Click ');
    const b = findPlainText($getRoot(), ' then ');
    if (!a || !b) throw new Error('setup');
    const sel = $createRangeSelection();
    sel.anchor.set(a.getKey(), 0, 'text');
    sel.focus.set(b.getKey(), 3, 'text');
    $setSelection(sel);
  }, 'overlap'));
  it('selection holding a variable chip', () => refuse(() => {
    const a = findPlainText($getRoot(), ' and ');
    const b = findPlainText($getRoot(), ' here.');
    if (!a || !b) throw new Error('setup');
    const sel = $createRangeSelection();
    sel.anchor.set(a.getKey(), 1, 'text');
    sel.focus.set(b.getKey(), 3, 'text');
    $setSelection(sel);
  }, 'overlap'));
  it('selection of bold text', () => refuse(() => $select('bold'), 'formatted'));

  it('unwrap with the caret in plain text reports nothing to unwrap', () => {
    const h = open(xml);
    let r: ReturnType<typeof $unwrapInlineAtSelection> | undefined;
    h.editor.update(() => { $caretIn('Click'); r = $unwrapInlineAtSelection(h.originMap); }, { discrete: true });
    expect(r).toEqual({ status: 'refused', reason: 'nothing-to-unwrap' });
  });

  it('unwrap works on an element that came from the source XML, with the caret inside it', () => {
    const h = open(xml);
    const before = h.serialize();
    h.editor.update(() => { $caretIn('Save'); $unwrapInlineAtSelection(h.originMap); }, { discrete: true });
    expect(h.serialize()).toBe(before.replace('<uicontrol>Save</uicontrol>', 'Save'));
  });
});

// ─── I7 — undo / redo ────────────────────────────────────────────────────────

describe('I7 — undo and redo of a wrap and an unwrap serialize to the matching state', () => {
  // History is registered BEFORE the parse, as in the app (HistoryPlugin is
  // mounted before SyncManager parses), so the parsed state is the baseline.
  const withHistory = (): Harness => {
    const xml = fixture('inline-contexts.dita');
    const editor = createTestEditor();
    registerHistory(editor, createEmptyHistoryState(), 0);
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);
    return { editor, originMap, xml, serialize: () => serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache) };
  };
  for (const tag of WRAP_TAGS) {
    it(`<${tag}>: wrap → undo → redo → unwrap → undo`, () => {
      const h = withHistory();
      const s0 = h.serialize();
      h.editor.update(() => { $select('define'); $wrapSelectionInInlineTag(tag, h.originMap, wrapAttrs(tag)); }, { discrete: true });
      const s1 = h.serialize();
      expect(s1).toBe(s0.replace('define', wrapped(tag, 'define')));

      h.editor.dispatchCommand(UNDO_COMMAND, undefined);
      expect(h.serialize()).toBe(s0);
      h.editor.dispatchCommand(REDO_COMMAND, undefined);
      expect(h.serialize()).toBe(s1);

      h.editor.update(() => { $reselect('define'); $unwrapInlineAtSelection(h.originMap); }, { discrete: true });
      expect(h.serialize()).toBe(s0);
      h.editor.dispatchCommand(UNDO_COMMAND, undefined);
      expect(h.serialize()).toBe(s1);
    });
  }
});
