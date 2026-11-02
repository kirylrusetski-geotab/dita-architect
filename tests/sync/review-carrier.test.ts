// @vitest-environment jsdom
//
// ADR-015 — the review carrier at the sync layer. Invariants I1–I5 from the
// ADR (I6 lives in tests/native-api-bridge.test.ts), each written before the
// code. Every expectation on XML is full-string equality.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, sep } from 'path';
import {
  $getRoot,
  $getSelection,
  $getPreviousSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  type LexicalNode,
  type ParagraphNode,
  type RangeSelection,
  type TextNode,
} from 'lexical';
import { createTestEditor, roundTrip } from '../helpers/createTestEditor';
import { parseXmlToLexical } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../../sync/nodeOriginMap';
import { $scanTrackedChanges } from '../../lib/tracked-changes/scan';
import { $acceptAllChanges, $acceptChange, $rejectAllChanges, $rejectChange } from '../../lib/tracked-changes/mutations';
import { $insertTrackedText, $markRangeAsDeleted, $trackedParagraphSplit } from '../../lib/tracked-changes/edits';
import { setSessionAuthor, type TrackedMark } from '../../lib/tracked-changes/model';
import { $isTrackedTextNode, type TrackedTextNode } from '../../components/TrackedTextNode';
import { listUnsupportedSuggestions, mappedKeys } from '../../lib/tracked-changes/pi-carrier';

const FIXTURES_DIR = join(__dirname, 'fixtures');
const CARRIER_DIR = join(FIXTURES_DIR, 'review-carrier');

function listDita(dir: string, base: string = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listDita(full, base));
    else if (entry.endsWith('.dita')) out.push(full.slice(base.length + 1).split(sep).join('/'));
  }
  return out.sort();
}
const read = (rel: string) => readFileSync(join(FIXTURES_DIR, rel), 'utf-8');
const carrier = (name: string) => readFileSync(join(CARRIER_DIR, name), 'utf-8');

const AUTHOR = 'author@example.com';
const DATE = '2026-11-02T16:00:00.000Z';
const DATE_MS = Date.parse(DATE);
const mark = (changeId: string, kind: TrackedMark['kind']): TrackedMark => ({ changeId, kind, author: AUTHOR, date: DATE });

const DOC = (body: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="r"><title>T</title><conbody>${body}</conbody></concept>`;

function open(xml: string) {
  const editor = createTestEditor();
  const originMap = createNodeOriginMap();
  const cache = createXmlMetaCache();
  parseXmlToLexical(xml, editor, originMap, true);
  const serialize = () => serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
  const scan = () => editor.getEditorState().read(() => $scanTrackedChanges());
  const update = (fn: () => void) => editor.update(fn, { discrete: true });
  return { editor, originMap, cache, serialize, scan, update };
}

function $paragraphs(): ParagraphNode[] {
  return $getRoot().getChildren().filter(n => n.getType() === 'paragraph') as ParagraphNode[];
}
function $findText(node: LexicalNode, needle: string): TextNode | null {
  if ($isTextNode(node) && node.getTextContent().includes(needle)) return node;
  if ($isElementNode(node)) for (const c of node.getChildren()) { const r = $findText(c, needle); if (r) return r; }
  return null;
}
function $sel(): RangeSelection {
  let sel = $getSelection();
  if (!$isRangeSelection(sel)) {
    const prev = $getPreviousSelection();
    if ($isRangeSelection(prev)) { const clone = prev.clone(); $setSelection(clone); sel = clone; }
  }
  if (!$isRangeSelection(sel)) throw new Error('expected a RangeSelection');
  return sel;
}
const summary = (changes: ReturnType<typeof $scanTrackedChanges>) =>
  changes.map(c => `${c.changeId}|${c.kind}|${c.author}|${c.date}|${c.text}`);

// ─── I1 — inert without marks ────────────────────────────────────────────────

describe('ADR-015 I1 — the carrier is inert on a document without suggestions', () => {
  const fixtures = listDita(FIXTURES_DIR).filter(f => !f.startsWith('review-carrier/'));

  it('the corpus is non-empty and still holds the two comment-carrying real topics', () => {
    expect(fixtures.length).toBeGreaterThan(40);
    expect(fixtures).toContain('sampled/topic/installation-codes.dita');
    expect(fixtures).toContain('sampled/troubleshooting-topic/why-are-fleet-benchmarks-missing-when-i-use-multiple-databases.dita');
  });

  for (const rel of fixtures) {
    it(`${rel}: round-trips byte-identically and parses to no tracked mark`, () => {
      const xml = read(rel);
      expect(roundTrip(xml)).toBe(xml);
      const { scan } = open(xml);
      expect(scan()).toEqual([]);
      expect(listUnsupportedSuggestions(xml, new Set())).toEqual([]);
    });
  }
});

// ─── Write side — exact PI output ────────────────────────────────────────────

describe('ADR-015 decision 4 — marks serialize as Heretto suggestion PIs', () => {
  const PLAIN = DOC('<p>One sentence body paragraph.</p><p>Second one here.</p>');

  it('an insert mark becomes a ct-ins pair around its text, and nothing else changes', () => {
    const { update, serialize } = open(PLAIN);
    update(() => {
      const t = $paragraphs()[0].getFirstChild() as TextNode;
      t.select(12, 12); // after "One sentence"
      $insertTrackedText($sel(), ' extra', mark('11111111-1111-4111-8111-111111111111', 'insert'));
    });
    expect(serialize()).toBe(PLAIN.replace(
      'One sentence body paragraph.',
      `One sentence<?ezd-review-start 11111111-1111-4111-8111-111111111111:ct-ins:${AUTHOR}:${DATE_MS}?> extra<?ezd-review-end 11111111-1111-4111-8111-111111111111?> body paragraph.`,
    ));
  });

  it('a delete mark becomes a ct-del pair around the KEPT text', () => {
    const { update, serialize } = open(PLAIN);
    update(() => {
      const t = $paragraphs()[0].getFirstChild() as TextNode;
      const sel = t.select(13, 17); // "body"
      $markRangeAsDeleted(sel, mark('22222222-2222-4222-8222-222222222222', 'delete'));
    });
    expect(serialize()).toBe(PLAIN.replace(
      'One sentence body paragraph.',
      `One sentence <?ezd-review-start 22222222-2222-4222-8222-222222222222:ct-del:${AUTHOR}:${DATE_MS}?>body<?ezd-review-end 22222222-2222-4222-8222-222222222222?> paragraph.`,
    ));
  });

  it('a bold delete puts the pair inside the <b>, around the struck text (the element stays whole)', () => {
    // Review finding 3: the splice stays inside the formatting element when
    // the mark carries that element's format, so no neighbouring character
    // is lost and the reopen sees a bold delete mark (review-carrier-hardening).
    const xml = DOC('<p>Keep <b>this</b> text.</p>');
    const { update, serialize } = open(xml);
    update(() => {
      const t = $findText($getRoot(), 'this')!;
      const sel = t.select(0, 4);
      $markRangeAsDeleted(sel, mark('33333333-3333-4333-8333-333333333333', 'delete'));
    });
    expect(serialize()).toBe(xml.replace(
      '<b>this</b>',
      `<b><?ezd-review-start 33333333-3333-4333-8333-333333333333:ct-del:${AUTHOR}:${DATE_MS}?>this<?ezd-review-end 33333333-3333-4333-8333-333333333333?></b>`,
    ));
  });

  it('a split marker becomes a ct-split pair: start PI last in the first paragraph, end PI first in the second', () => {
    setSessionAuthor(AUTHOR);
    const { update, serialize, editor } = open(PLAIN);
    update(() => {
      const t = $paragraphs()[0].getFirstChild() as TextNode;
      t.select(13, 13); // before "body"
      $trackedParagraphSplit($sel());
    });
    const marker = editor.getEditorState().read(() => ($paragraphs()[1].getFirstChild() as TrackedTextNode).getMark());
    expect(marker.kind).toBe('split');
    expect(marker.author).toBe(AUTHOR);
    const ms = Date.parse(marker.date);
    expect(serialize()).toBe(PLAIN.replace(
      '<p>One sentence body paragraph.</p>',
      `<p>One sentence <?ezd-review-start ${marker.changeId}:ct-split:${AUTHOR}:${ms}?></p><p><?ezd-review-end ${marker.changeId}?>body paragraph.</p>`,
    ));
  });

  it('a delete inside an <xref> keeps the pair inside the link and the link attributes untouched', () => {
    const xml = DOC('<p>See <xref href="a.dita" format="dita">the old guide</xref> now.</p>');
    const { update, serialize } = open(xml);
    update(() => {
      const t = $findText($getRoot(), 'old')!;
      const s = t.getTextContent().indexOf('old');
      $markRangeAsDeleted(t.select(s, s + 4), mark('44444444-4444-4444-8444-444444444444', 'delete'));
    });
    expect(serialize()).toBe(xml.replace(
      'the old guide',
      `the <?ezd-review-start 44444444-4444-4444-8444-444444444444:ct-del:${AUTHOR}:${DATE_MS}?>old <?ezd-review-end 44444444-4444-4444-8444-444444444444?>guide`,
    ));
  });
});

// ─── I2 / I3 / I4 — across a save and a reopen ───────────────────────────────

describe('ADR-015 I2–I4 — suggestions survive a save and a reopen', () => {
  const ORIGINAL = DOC('<p>The quick brown fox jumps over the lazy dog.</p><p>Second paragraph with steady content.</p>');

  function suggestThreeKinds() {
    setSessionAuthor(AUTHOR);
    const a = open(ORIGINAL);
    a.update(() => {
      const t = $paragraphs()[0].getFirstChild() as TextNode;
      t.select(9, 9); // after "The quick"
      $insertTrackedText($sel(), ' extremely', mark('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'insert'));
    });
    a.update(() => {
      const t = $findText($getRoot(), 'lazy')!;
      const s = t.getTextContent().indexOf('lazy ');
      $markRangeAsDeleted(t.select(s, s + 5), mark('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'delete'));
    });
    a.update(() => {
      const t = $paragraphs()[1].getFirstChild() as TextNode;
      t.select(17, 17); // "Second paragraph |with steady content."
      $trackedParagraphSplit($sel());
    });
    return a;
  }

  it('I2: parse the saved XML — the change list is the same (ids, kinds, authors, dates, text, order)', () => {
    const a = suggestThreeKinds();
    const before = summary(a.scan());
    expect(before).toHaveLength(3);
    expect(before.map(s => s.split('|')[1])).toEqual(['insert', 'delete', 'split']);
    const saved = a.serialize();
    expect(saved).toContain('ct-ins');
    expect(saved).toContain('ct-del');
    expect(saved).toContain('ct-split');

    const b = open(saved);
    expect(summary(b.scan())).toEqual(before);
    // and the reopened document is itself byte-stable: a second unedited save sends the same bytes
    expect(b.serialize()).toBe(saved);
  });

  it('I3: Reject All after the reopen serializes byte-equal to the document before any suggestion', () => {
    const saved = suggestThreeKinds().serialize();
    const b = open(saved);
    b.update(() => $rejectAllChanges());
    expect(b.scan()).toEqual([]);
    expect(b.serialize()).toBe(ORIGINAL);
  });

  it('I4: Accept All after the reopen serializes byte-equal to the same edits made directly', () => {
    const saved = suggestThreeKinds().serialize();
    const b = open(saved);
    b.update(() => $acceptAllChanges());
    expect(b.scan()).toEqual([]);
    const accepted = b.serialize();

    const direct = open(ORIGINAL);
    direct.update(() => {
      const t = $paragraphs()[0].getFirstChild() as TextNode;
      t.spliceText(9, 0, ' extremely', false);
    });
    direct.update(() => {
      const t = $findText($getRoot(), 'lazy')!;
      const s = t.getTextContent().indexOf('lazy ');
      t.spliceText(s, 5, '', false);
    });
    direct.update(() => {
      const t = $paragraphs()[1].getFirstChild() as TextNode;
      t.select(17, 17);
      $sel().insertParagraph();
    });
    expect(accepted).toBe(direct.serialize());
    expect(accepted).toContain('The quick extremely brown fox jumps over the dog.');
    expect(accepted).toContain('<p>Second paragraph </p><p>with steady content.</p>');
  });

  it('a carried mark is an anchor: an edit elsewhere in the paragraph leaves its bytes untouched', () => {
    const saved = suggestThreeKinds().serialize();
    const b = open(saved);
    b.update(() => {
      const t = $findText($getRoot(), 'dog')!;
      t.setTextContent(t.getTextContent().replace('dog.', 'dog!'));
    });
    expect(b.serialize()).toBe(saved.replace('dog.', 'dog!'));
  });
});

// ─── I5 — Heretto's own output ───────────────────────────────────────────────

describe('ADR-015 I5 — suggestions made in Heretto open as marks of the right kind', () => {
  for (const name of listDita(CARRIER_DIR)) {
    it(`${name}: an unedited round trip is byte-identical`, () => {
      const xml = carrier(name);
      expect(roundTrip(xml)).toBe(xml);
    });
  }

  it('ct-del: one delete mark carrying the kept text, the author email, and the timestamp', () => {
    const xml = carrier('heretto-ct-del.dita');
    const changes = open(xml).scan();
    expect(summary(changes)).toEqual([
      `29518720-0774-4c3e-aff3-faa08db47921|insert|${AUTHOR}|${new Date(1792524402429).toISOString()}| over here`,
      `d313682d-1ade-4fa5-8e86-2d9514f2e44e|delete|${AUTHOR}|${new Date(1793636289210).toISOString()}|existing`,
    ]);
    expect(listUnsupportedSuggestions(xml, mappedKeys(changes))).toEqual([]);
  });

  it('the replace pair: an insert and a delete sharing one changeId, two rows, resolved together', () => {
    const xml = carrier('heretto-replace-pair.dita');
    const { scan, update, serialize } = open(xml);
    const changes = scan();
    expect(summary(changes)).toEqual([
      `29518720-0774-4c3e-aff3-faa08db47921|insert|${AUTHOR}|${new Date(1792524402429).toISOString()}| over here`,
      `d313682d-1ade-4fa5-8e86-2d9514f2e44e|delete|${AUTHOR}|${new Date(1793636289210).toISOString()}|existing`,
      `b9791ffd-569e-46c2-9807-14fa5eab9c84|insert|${AUTHOR}|${new Date(1793636711165).toISOString()}|sentence`,
      `b9791ffd-569e-46c2-9807-14fa5eab9c84|delete|${AUTHOR}|${new Date(1793636707892).toISOString()}|paragraph`,
    ]);
    // Reject the pair: Heretto's own result for this step (second pass, step 12)
    update(() => $rejectChange('b9791ffd-569e-46c2-9807-14fa5eab9c84'));
    expect(serialize()).toBe(xml.replace(
      `<?ezd-review-start b9791ffd-569e-46c2-9807-14fa5eab9c84:ct-ins:${AUTHOR}:1793636711165?>sentence<?ezd-review-end b9791ffd-569e-46c2-9807-14fa5eab9c84?><?ezd-review-start b9791ffd-569e-46c2-9807-14fa5eab9c84:ct-del:${AUTHOR}:1793636707892?>paragraph<?ezd-review-end b9791ffd-569e-46c2-9807-14fa5eab9c84?>`,
      'paragraph',
    ));
  });

  it('accepting the replace pair keeps the new text and drops the struck original', () => {
    const xml = carrier('heretto-replace-pair.dita');
    const { update, serialize } = open(xml);
    update(() => $acceptChange('b9791ffd-569e-46c2-9807-14fa5eab9c84'));
    expect(serialize()).toBe(xml.replace(
      `<?ezd-review-start b9791ffd-569e-46c2-9807-14fa5eab9c84:ct-ins:${AUTHOR}:1793636711165?>sentence<?ezd-review-end b9791ffd-569e-46c2-9807-14fa5eab9c84?><?ezd-review-start b9791ffd-569e-46c2-9807-14fa5eab9c84:ct-del:${AUTHOR}:1793636707892?>paragraph<?ezd-review-end b9791ffd-569e-46c2-9807-14fa5eab9c84?>`,
      'sentence',
    ));
  });

  it('accepting a Heretto ct-del removes the text and both PIs, leaving the surrounding whitespace as it was (second pass, step 13)', () => {
    const xml = carrier('heretto-ct-del.dita');
    const { update, serialize } = open(xml);
    update(() => $acceptChange('d313682d-1ade-4fa5-8e86-2d9514f2e44e'));
    expect(serialize()).toBe(xml.replace(
      `<?ezd-review-start d313682d-1ade-4fa5-8e86-2d9514f2e44e:ct-del:${AUTHOR}:1793636289210?>existing<?ezd-review-end d313682d-1ade-4fa5-8e86-2d9514f2e44e?>`,
      '',
    ));
  });

  it('the first pass: a ct-ins in two fragments across a ct-split is one insert and one split', () => {
    const xml = carrier('heretto-split.dita');
    const { scan, update, serialize } = open(xml);
    expect(summary(scan())).toEqual([
      `a9fb170e-18dd-4e67-a740-7e243d0720d6|insert|${AUTHOR}|${new Date(1792523746308).toISOString()}| Added edits existing paragraph.`,
      `0cb9e52d-ec01-4378-a4e9-d3e7e0ab9a8a|split|${AUTHOR}|${new Date(1792523752079).toISOString()}|`,
    ]);
    // Reject the split alone: the two paragraphs merge back, both split PIs go,
    // and each insert fragment keeps its own pair. The one byte not kept is the
    // trailing " " before </p>: PI-adjacent whitespace has no editor node (the
    // parser drops it), so it cannot follow the content into the merged block.
    update(() => $rejectChange('0cb9e52d-ec01-4378-a4e9-d3e7e0ab9a8a'));
    expect(serialize()).toBe(xml.replace(
      `<?ezd-review-start 0cb9e52d-ec01-4378-a4e9-d3e7e0ab9a8a:ct-split:${AUTHOR}:1792523752079?></p><p class="- topic/p "><?ezd-review-end 0cb9e52d-ec01-4378-a4e9-d3e7e0ab9a8a?>`,
      '',
    ).replace('<?ezd-review-end a9fb170e-18dd-4e67-a740-7e243d0720d6?> </p>', '<?ezd-review-end a9fb170e-18dd-4e67-a740-7e243d0720d6?></p>'));
  });

  it('a bold toggle (a pair straddling <b>) is not a mark: zero marks for it, one listed unsupported suggestion', () => {
    const xml = carrier('heretto-bold-wrap.dita');
    const changes = open(xml).scan();
    expect(changes.map(c => `${c.kind}:${c.text}`)).toEqual(['insert: over here', 'delete:existing']);
    expect(listUnsupportedSuggestions(xml, mappedKeys(changes))).toEqual([
      { changeId: '99902364-a1c2-41ed-a33f-fe0abbe0031f', kind: 'ct-ins', author: AUTHOR, dateMs: 1793636530061 },
    ]);
  });

  it('the kitchen sink: six marks, and the bold wrap and the whole-<p> insert listed as unsupported', () => {
    const xml = carrier('heretto-kitchen-sink.dita');
    const changes = open(xml).scan();
    expect(changes.map(c => `${c.kind}:${c.text}`)).toEqual([
      'insert: over here',
      'delete:existing',
      'insert:sentence',
      'delete:paragraph',
      'delete:.',
      'insert:Brand new paragraph',
    ]);
    expect(listUnsupportedSuggestions(xml, mappedKeys(changes))).toEqual([
      { changeId: '99902364-a1c2-41ed-a33f-fe0abbe0031f', kind: 'ct-ins', author: AUTHOR, dateMs: 1793636530061 },
      { changeId: '5e5c46ca-8157-4b86-8cb1-d741b6038a2e', kind: 'ct-ins', author: AUTHOR, dateMs: 1793637142239 },
    ]);
  });

  it('an unsupported pair survives an edit elsewhere in the same paragraph, byte for byte', () => {
    const xml = carrier('heretto-bold-wrap.dita');
    const { update, serialize } = open(xml);
    update(() => {
      const t = $findText($getRoot(), 'Added edits')!;
      t.setTextContent(t.getTextContent().replace('Added edits', 'Added more edits'));
    });
    expect(serialize()).toBe(xml.replace('Added edits', 'Added more edits'));
  });

  it('a comment is not a suggestion: the two real topics list nothing', () => {
    for (const rel of [
      'sampled/topic/installation-codes.dita',
      'sampled/troubleshooting-topic/why-are-fleet-benchmarks-missing-when-i-use-multiple-databases.dita',
    ]) {
      const xml = read(rel);
      expect(xml).toContain(':comment:');
      expect(open(xml).scan()).toEqual([]);
      expect(listUnsupportedSuggestions(xml, new Set())).toEqual([]);
    }
  });

  it('the parsed marks are real TrackedTextNodes: a delete is token-mode, a split is zero-width', () => {
    const { editor } = open(carrier('heretto-split.dita'));
    editor.getEditorState().read(() => {
      const nodes: TrackedTextNode[] = [];
      const walk = (n: LexicalNode) => { if ($isTrackedTextNode(n)) nodes.push(n); if ($isElementNode(n)) n.getChildren().forEach(walk); };
      walk($getRoot());
      const split = nodes.find(n => n.getMark().kind === 'split')!;
      expect(split.getTextContent()).toBe('');
      expect(split.getMode()).toBe('token');
      expect(split.getParent()?.getIndexWithinParent()).toBe(3); // root: h1 title, shortdesc paragraph, first body <p>, this one
      expect(split.getIndexWithinParent()).toBe(0); // at the head of its block, DA's own shape
    });
  });
});
