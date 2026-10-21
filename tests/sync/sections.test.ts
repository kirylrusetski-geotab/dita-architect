// @vitest-environment jsdom
//
// ADR-011 (BUG-28 + BUG-35) — sections are identity-carrying containers,
// matched by ordinal, deleted by provenance; author-created blocks inherit
// their container. Invariants S2–S10, written before the implementation.
// (S1 is the existing corpus suites: byte-stability, inline-reconcile R1,
// structure-check.)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  $isElementNode,
  type LexicalNode,
} from 'lexical';
import { $createHeadingNode } from '@lexical/rich-text';
import { $createListNode, $createListItemNode } from '@lexical/list';
import { $createTableNode, $createTableRowNode, $createTableCellNode, TableCellHeaderStates } from '@lexical/table';
import { createTestEditor } from '../helpers/createTestEditor';
import { parseXmlToLexical } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../../sync/nodeOriginMap';
import { checkSerializedStructure } from '../../sync/structure-check';

const FIXTURES = join(__dirname, 'fixtures');

const CONCEPT = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="c"><title>T</title><conbody>${body}</conbody></concept>`;
const TROUBLE = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE troubleshooting PUBLIC "-//OASIS//DTD DITA Troubleshooting//EN" "troubleshooting.dtd">\n<troubleshooting id="t"><title>T</title><troublebody>${body}</troublebody></troubleshooting>`;

function run(xml: string, edit?: () => void) {
  const editor = createTestEditor();
  const originMap = createNodeOriginMap();
  parseXmlToLexical(xml, editor, originMap, true);
  if (edit) editor.update(edit, { discrete: true });
  const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
  return { out, mismatches: checkSerializedStructure(editor.getEditorState(), out, originMap) };
}

/** The top-level node whose text is exactly `text`. */
function $block(text: string): LexicalNode {
  const n = $getRoot().getChildren().find(c => c.getTextContent() === text);
  if (!n) throw new Error(`no top-level block "${text}"`);
  return n;
}
function $setText(text: string, next: string) {
  const b = $block(text);
  if (!$isElementNode(b)) throw new Error('not an element');
  b.clear();
  b.append($createTextNode(next));
}
const $para = (text: string) => { const p = $createParagraphNode(); p.append($createTextNode(text)); return p; };
const count = (x: string, re: RegExp) => (x.match(re) ?? []).length;

// ─── S2 — the BUG-28 fixtures keep their structure ───────────────────────────

describe('S2 — the BUG-28 fixtures keep every section, list, item, and paragraph', () => {
  for (const rel of [
    'sampled/topic/altitude-api-reuse.dita',
    'sampled/reference/j1939-ev-mandatory-signals.dita',
    'sampled/concept/external-aux-rear-cam.dita',
  ]) {
    it(rel, () => {
      const xml = readFileSync(join(FIXTURES, rel), 'utf-8');
      const { out, mismatches } = run(xml);
      expect(mismatches).toEqual([]);
      for (const re of [/<section[\s>/]/g, /<ul[\s>]/g, /<li[\s>]/g, /<p[\s>]/g, /<table[\s>]/g, /<note[\s>]/g]) {
        expect(count(out, re), `${re}`).toBe(count(xml, re));
      }
    });
  }
});

// ─── S3 — edits inside an untitled section ───────────────────────────────────

describe('S3 — an edit inside an untitled section lands there; wrapper, id, class byte-identical', () => {
  const xml = CONCEPT('<p>Before.</p><section id="u1" class="- topic/section " outputclass="x"><p>Inside one.</p><p>Inside two.</p></section><section id="t1"><title>Titled</title><p>Three.</p></section>');

  it('unedited round trip is byte-stable', () => {
    expect(run(xml).out).toBe(xml);
  });
  it('edit the second paragraph of the untitled section', () => {
    expect(run(xml, () => $setText('Inside two.', 'Inside two, edited.')).out)
      .toBe(xml.replace('Inside two.', 'Inside two, edited.'));
  });
  it('edit inside the titled section that follows', () => {
    expect(run(xml, () => $setText('Three.', 'Three, edited.')).out)
      .toBe(xml.replace('Three.', 'Three, edited.'));
  });
  it('untitled section holding a table whose cell has a list (the altitude-api-reuse shape)', () => {
    const t = CONCEPT('<section><table><tgroup cols="1"><tbody><row><entry><p>Intro</p><ul><li>One</li><li>Two</li></ul></entry></row></tbody></tgroup></table></section><p>After.</p>');
    expect(run(t).out).toBe(t);
    expect(run(t, () => $setText('After.', 'After, edited.')).out).toBe(t.replace('After.', 'After, edited.'));
  });
});

// ─── S4 — deleting one section removes exactly that one ──────────────────────

describe('S4 — deleting every node of one section removes exactly that section', () => {
  const xml = CONCEPT('<p>Keep.</p><section id="s1"><title>Gone</title><p>Inside.</p></section><section id="s2"><title>Stays</title><p>Also.</p></section><section id="s3"><p>Untitled.</p></section>');

  it('delete the first titled section', () => {
    const { out } = run(xml, () => { $block('Gone').remove(); $block('Inside.').remove(); });
    expect(out).toBe(xml.replace('<section id="s1"><title>Gone</title><p>Inside.</p></section>', ''));
  });
  it('delete the untitled section (its content and its boundary marker)', () => {
    const { out } = run(xml, () => {
      const untitled = $block('Untitled.');
      const marker = untitled.getPreviousSibling();
      untitled.remove();
      if (marker && marker.getType() === 'dita-container-boundary') marker.remove();
    });
    expect(out).toBe(xml.replace('<section id="s3"><p>Untitled.</p></section>', ''));
  });
  it('delete the middle section: the last keeps its own id and content', () => {
    const { out } = run(xml, () => { $block('Stays').remove(); $block('Also.').remove(); });
    expect(out).toBe(xml.replace('<section id="s2"><title>Stays</title><p>Also.</p></section>', ''));
  });
});

// ─── S5 — empty and conref sections are never deleted ────────────────────────

describe('S5 — sections that produced no editor nodes are preserved', () => {
  it('go10: adding a paragraph keeps all seven conref sections', () => {
    const xml = readFileSync(join(FIXTURES, 'sampled/reference/go10-regulatory-statements.dita'), 'utf-8');
    const { out } = run(xml, () => { $getRoot().append($para('A new paragraph.')); });
    expect(count(out, /<section conref=/g)).toBe(7);
    const sections = (x: string) => x.match(/<section conref="[^"]*" class="[^"]*"\/>/g) ?? [];
    expect(sections(out)).toEqual(sections(xml));
    expect(out).toContain('<p>A new paragraph.</p></refbody>');
  });
  it('an empty <section/> next to edited content survives', () => {
    const xml = CONCEPT('<p>Edit me.</p><section id="empty"/><section><p>Other.</p></section>');
    expect(run(xml, () => $setText('Edit me.', 'Edited.')).out).toBe(xml.replace('Edit me.', 'Edited.'));
  });
  it('an empty <cause/> next to an edited remedy survives', () => {
    const xml = TROUBLE('<condition><p>Symptom.</p></condition><troubleSolution><cause/><remedy><steps><step><cmd>Do it.</cmd></step></steps></remedy></troubleSolution>');
    const { out } = run(xml, () => {
      const list = $getRoot().getChildren().find(c => c.getType() === 'list');
      const li = list && $isElementNode(list) ? list.getFirstChild() : null;
      if (!li || !$isElementNode(li)) throw new Error('no step');
      li.clear(); li.append($createTextNode('Do it now.'));
    });
    expect(out).toBe(xml.replace('Do it.', 'Do it now.'));
  });
});

// ─── S6 — a new heading creates a new section ────────────────────────────────

describe('S6 — a new h2 creates a new <section> and leaves existing ones byte-identical', () => {
  const xml = CONCEPT('<p>Intro.</p><section id="s1"><title>One</title><p>First.</p></section><section id="s2"><p>Second.</p></section>');
  const NEW = '<section><title>New</title><p>Body.</p></section>';
  const $newSection = () => { const h = $createHeadingNode('h2'); h.append($createTextNode('New')); return [h, $para('Body.')] as const; };

  it('before the existing sections', () => {
    const { out } = run(xml, () => { const [h, p] = $newSection(); $block('Intro.').insertAfter(h); h.insertAfter(p); });
    expect(out).toBe(xml.replace('<section id="s1">', NEW + '<section id="s1">'));
  });
  it('between two existing sections', () => {
    const { out } = run(xml, () => {
      const [h, p] = $newSection();
      const second = $block('Second.');
      const marker = second.getPreviousSibling();
      (marker && marker.getType() === 'dita-container-boundary' ? marker : second).insertBefore(h);
      h.insertAfter(p);
    });
    expect(out).toBe(xml.replace('<section id="s2">', NEW + '<section id="s2">'));
  });
  it('after the last section', () => {
    const { out } = run(xml, () => { const [h, p] = $newSection(); $getRoot().append(h, p); });
    expect(out).toBe(xml.replace('</conbody>', NEW + '</conbody>'));
  });
});

// ─── S7 — adjacent untitled sections keep their lists apart ──────────────────

describe('S7 — two adjacent untitled sections with lists at the seam stay two lists', () => {
  it('unedited, and after an edit elsewhere', () => {
    const xml = CONCEPT('<p>Top.</p><section><p>A.</p><ul><li>a1</li></ul></section><section><ul><li>b1</li></ul><p>B.</p></section>');
    expect(run(xml).out).toBe(xml);
    expect(run(xml, () => $setText('Top.', 'Top, edited.')).out).toBe(xml.replace('Top.', 'Top, edited.'));
  });
});

// ─── S8 — BUG-35: lists in table cells ───────────────────────────────────────

describe('S8 — BUG-35: a list in a table cell is never dropped', () => {
  const xml = CONCEPT('<table><tgroup cols="1"><tbody><row><entry><p>Intro</p><ul><li>One</li><li>Two</li></ul></entry></row></tbody></tgroup></table>');

  it('a table built in the editor with a list in a cell keeps the list (createTableFromLexical)', () => {
    // The earlier version of this test removed a preceding <note>, which only
    // shifted the walk: the table was patched, not rebuilt. A brand-new table
    // has no DOM counterpart, so it must go through createTableFromLexical.
    const base = CONCEPT('<p>Before.</p>');
    const { out } = run(base, () => {
      const table = $createTableNode();
      const row = $createTableRowNode();
      const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
      cell.append($para('Intro'));
      const ul = $createListNode('bullet');
      for (const t of ['One', 'Two']) { const li = $createListItemNode(); li.append($createTextNode(t)); ul.append(li); }
      cell.append(ul);
      row.append(cell);
      table.append(row);
      $getRoot().append(table);
    });
    expect(out).toContain('<entry><p>Intro</p><ul><li>One</li><li>Two</li></ul></entry>');
  });

  it('a list the author adds to a cell is serialized', () => {
    const plain = CONCEPT('<table><tgroup cols="1"><tbody><row><entry><p>Intro</p></entry></row></tbody></tgroup></table>');
    const { out } = run(plain, () => {
      const table = $getRoot().getChildren().find(c => c.getType() === 'table');
      if (!table || !$isElementNode(table)) throw new Error('no table');
      const row = table.getFirstChild(); const cell = row && $isElementNode(row) ? row.getFirstChild() : null;
      if (!cell || !$isElementNode(cell)) throw new Error('no cell');
      const ul = $createListNode('bullet');
      const li = $createListItemNode(); li.append($createTextNode('Added'));
      ul.append(li); cell.append(ul);
    });
    expect(out).toContain('<entry><p>Intro</p><ul><li>Added</li></ul></entry>');
  });

  it('unedited cell list is still byte-stable', () => {
    expect(run(xml).out).toBe(xml);
  });
});

// ─── S9 — troubleshooting containers ─────────────────────────────────────────

describe('S9 — deleting a whole non-empty <cause> now removes it (ADR-009 limit lifted)', () => {
  it('cause with content, deleted in the editor', () => {
    const xml = TROUBLE('<condition><p>Symptom.</p></condition><troubleSolution><cause><p>The cause.</p></cause><remedy><steps><step><cmd>Fix.</cmd></step></steps></remedy></troubleSolution>');
    const { out } = run(xml, () => {
      const cause = $block('The cause.');
      const marker = cause.getPreviousSibling();
      cause.remove();
      if (marker && marker.getType() === 'dita-container-boundary') marker.remove();
    });
    expect(out).toBe(xml.replace('<cause><p>The cause.</p></cause>', ''));
  });
});

// ─── S10 — author-created blocks inherit their container ─────────────────────

describe('S10 — a paragraph the author adds inside a container is written inside it', () => {
  it('after the last paragraph of a titled section', () => {
    const xml = CONCEPT('<section id="s1"><title>One</title><p>First.</p></section><section id="s2"><title>Two</title><p>Second.</p></section>');
    const { out } = run(xml, () => { $block('First.').insertAfter($para('Added.')); });
    expect(out).toBe(xml.replace('<p>First.</p></section>', '<p>First.</p><p>Added.</p></section>'));
  });
  it('after the last paragraph of an untitled section', () => {
    const xml = CONCEPT('<section id="u"><p>First.</p></section><p>Body level.</p>');
    const { out } = run(xml, () => { $block('First.').insertAfter($para('Added.')); });
    expect(out).toBe(xml.replace('<p>First.</p></section>', '<p>First.</p><p>Added.</p></section>'));
  });
  it('after the last paragraph of a <cause>', () => {
    const xml = TROUBLE('<condition><p>Symptom.</p></condition><troubleSolution><cause><p>Cause.</p></cause><remedy><steps><step><cmd>Fix.</cmd></step></steps></remedy></troubleSolution>');
    const { out } = run(xml, () => { $block('Cause.').insertAfter($para('Added.')); });
    expect(out).toBe(xml.replace('<p>Cause.</p></cause>', '<p>Cause.</p><p>Added.</p></cause>'));
  });
  it('after a body-level paragraph that precedes the sections: stays at body level', () => {
    const xml = CONCEPT('<p>Body.</p><section id="s1"><title>One</title><p>First.</p></section>');
    const { out } = run(xml, () => { $block('Body.').insertAfter($para('Added.')); });
    expect(out).toBe(xml.replace('<p>Body.</p>', '<p>Body.</p><p>Added.</p>'));
  });
});
