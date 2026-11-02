// @vitest-environment jsdom
//
// ADR-015 — findings of the adversarial review (Execution Plan Session 6,
// Build discipline rule 7), each pinned here before its fix. The reviewer did
// not write the carrier; these are the scenarios it confirmed with probes.
import { describe, it, expect } from 'vitest';
import {
  $getRoot,
  $getSelection,
  $getPreviousSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  type LexicalNode,
  type RangeSelection,
  type TextNode,
} from 'lexical';
import { createTestEditor } from '../helpers/createTestEditor';
import { parseXmlToLexical } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../../sync/nodeOriginMap';
import { $scanTrackedChanges } from '../../lib/tracked-changes/scan';
import { $acceptAllChanges, $rejectAllChanges, $rejectChange } from '../../lib/tracked-changes/mutations';
import { $insertTrackedText, $markRangeAsDeleted, $trackedParagraphSplit } from '../../lib/tracked-changes/edits';
import { setSessionAuthor, type TrackedMark } from '../../lib/tracked-changes/model';
import { listUnsupportedSuggestions, mappedKeys } from '../../lib/tracked-changes/pi-carrier';

const AUTHOR = 'author@example.com';
const DATE = '2026-11-02T16:00:00.000Z';
const MS = Date.parse(DATE);
const mark = (changeId: string, kind: TrackedMark['kind']): TrackedMark => ({ changeId, kind, author: AUTHOR, date: DATE });
const DEL = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const DOC = (body: string, root: 'concept' | 'task' = 'concept'): string => {
  const bodyTag = root === 'concept' ? 'conbody' : 'taskbody';
  const dtd = root === 'concept'
    ? '<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">'
    : '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">';
  return `<?xml version="1.0" encoding="UTF-8"?>\n${dtd}\n<${root} id="r"><title>T</title><${bodyTag}>${body}</${bodyTag}></${root}>`;
};

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

// ─── Finding 3 — a tracked run spliced inside a <b>/<i>/<codeph> ─────────────

describe('review finding 3 — a suggestion inside a formatting element keeps the unchanged characters', () => {
  const XML = DOC('<p>Keep <b>this</b> text.</p>');

  it('deleting "hi" inside <b>this</b> strikes only "hi": the pair sits inside the <b>, t and s stay', () => {
    const { update, serialize, scan } = open(XML);
    update(() => {
      const t = $findText($getRoot(), 'this')!;
      $markRangeAsDeleted(t.select(1, 3), mark(DEL, 'delete'));
    });
    expect(serialize()).toBe(XML.replace(
      '<b>this</b>',
      `<b>t<?ezd-review-start ${DEL}:ct-del:${AUTHOR}:${MS}?>hi<?ezd-review-end ${DEL}?>s</b>`,
    ));
    expect(scan().map(c => `${c.kind}:${c.text}`)).toEqual(['delete:hi']);
  });

  it('inserting inside <b>this</b> keeps the characters in order', () => {
    const { update, serialize } = open(XML);
    update(() => {
      const t = $findText($getRoot(), 'this')!;
      t.select(2, 2);
      $insertTrackedText($sel(), 'NEW', mark('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'insert'));
    });
    expect(serialize()).toBe(XML.replace(
      '<b>this</b>',
      `<b>th<?ezd-review-start eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee:ct-ins:${AUTHOR}:${MS}?>NEW<?ezd-review-end eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee?>is</b>`,
    ));
  });

  it('the saved form reopens as the same mark, and Accept / Reject after the reopen are exact', () => {
    const { update, serialize } = open(XML);
    update(() => {
      const t = $findText($getRoot(), 'this')!;
      $markRangeAsDeleted(t.select(1, 3), mark(DEL, 'delete'));
    });
    const saved = serialize();

    const reopened = open(saved);
    expect(reopened.scan().map(c => `${c.kind}:${c.text}`)).toEqual(['delete:hi']);
    expect(reopened.serialize()).toBe(saved);
    reopened.update(() => $rejectAllChanges());
    expect(reopened.serialize()).toBe(XML);

    const accepted = open(saved);
    accepted.update(() => $acceptAllChanges());
    expect(accepted.serialize()).toBe(XML.replace('<b>this</b>', '<b>ts</b>'));
  });

  it('a whole bold word struck: the pair wraps the text inside the <b>, and the reopen sees a bold delete mark', () => {
    const { update, serialize } = open(XML);
    update(() => {
      const t = $findText($getRoot(), 'this')!;
      $markRangeAsDeleted(t.select(0, 4), mark(DEL, 'delete'));
    });
    const saved = serialize();
    expect(saved).toBe(XML.replace(
      '<b>this</b>',
      `<b><?ezd-review-start ${DEL}:ct-del:${AUTHOR}:${MS}?>this<?ezd-review-end ${DEL}?></b>`,
    ));
    const reopened = open(saved);
    expect(reopened.scan().map(c => `${c.kind}:${c.text}`)).toEqual(['delete:this']);
    reopened.editor.getEditorState().read(() => {
      const n = $findText($getRoot(), 'this')!;
      expect(n.getType()).toBe('tracked-text');
      expect(n.hasFormat('bold')).toBe(true);
    });
    reopened.update(() => $rejectAllChanges());
    expect(reopened.serialize()).toBe(XML);
  });
});

// ─── Finding 2 — a tracked delete over a stamped token keeps its element ────

describe('review finding 2 (BUG-50) — a struck <uicontrol> is still a <uicontrol>', () => {
  const XML = DOC('<p>Click <uicontrol>Save</uicontrol> to finish.</p>');

  it('the delete mark carries the stamp: the pair wraps the element, Heretto never sees <b>', () => {
    const { update, serialize, originMap } = open(XML);
    update(() => {
      const t = $findText($getRoot(), 'Save')!;
      $markRangeAsDeleted(t.select(0, 4), mark(DEL, 'delete'), originMap);
    });
    expect(serialize()).toBe(XML.replace(
      '<uicontrol>Save</uicontrol>',
      `<?ezd-review-start ${DEL}:ct-del:${AUTHOR}:${MS}?><uicontrol>Save</uicontrol><?ezd-review-end ${DEL}?>`,
    ));
  });

  it('after a reopen: the mark is there; Reject restores the source byte for byte; Accept removes the element', () => {
    const { update, serialize, originMap } = open(XML);
    update(() => {
      const t = $findText($getRoot(), 'Save')!;
      $markRangeAsDeleted(t.select(0, 4), mark(DEL, 'delete'), originMap);
    });
    const saved = serialize();

    const a = open(saved);
    expect(a.scan().map(c => `${c.kind}:${c.text}`)).toEqual(['delete:Save']);
    expect(a.serialize()).toBe(saved);
    a.update(() => $rejectChange(DEL, a.originMap));
    expect(a.serialize()).toBe(XML);

    const b = open(saved);
    b.update(() => $acceptAllChanges(b.originMap));
    expect(b.serialize()).toBe(XML.replace('<uicontrol>Save</uicontrol>', ''));
  });

  it('rejecting in the same session (no save) also restores the <uicontrol>', () => {
    const { update, serialize, originMap } = open(XML);
    update(() => {
      const t = $findText($getRoot(), 'Save')!;
      $markRangeAsDeleted(t.select(0, 4), mark(DEL, 'delete'), originMap);
    });
    update(() => $rejectChange(DEL, originMap));
    expect(serialize()).toBe(XML);
  });
});

// ─── Finding 4 — a split the carrier cannot place is refused, not approximated ─

describe('review finding 4 — Enter in Suggesting mode is refused where Heretto\'s split shape cannot be written', () => {
  const cases: Array<[string, string, string]> = [
    ['a table cell', DOC('<simpletable><strow><stentry>one two</stentry></strow></simpletable>'), 'one two'],
    ['a <dd>', DOC('<dl><dlentry><dt>Term</dt><dd>one two</dd></dlentry></dl>'), 'one two'],
    ['a <note>', DOC('<note>one two</note>'), 'one two'],
    ['a list item', DOC('<ul><li>one two</li></ul>'), 'one two'],
    ['a <p> that wraps blocks', DOC('<p>one two<ul><li>x</li></ul></p>'), 'one two'],
    ['the title', DOC('<p>body</p>'), 'T'],
  ];
  for (const [where, xml, needle] of cases) {
    it(`${where}: blocked-split, the tree and the XML are unchanged`, () => {
      setSessionAuthor(AUTHOR);
      const { update, serialize, scan, originMap, editor } = open(xml);
      const before = editor.getEditorState().read(() => $getRoot().getChildren().length);
      let status = '';
      update(() => {
        const t = $findText($getRoot(), needle)!;
        t.select(3, 3);
        status = $trackedParagraphSplit($sel(), originMap).status;
      });
      expect(status).toBe('blocked-split');
      expect(editor.getEditorState().read(() => $getRoot().getChildren().length)).toBe(before);
      expect(scan()).toEqual([]);
      expect(serialize()).toBe(xml);
    });
  }

  it('a body-level paragraph inside a <section> is allowed (its previous sibling is the first half)', () => {
    setSessionAuthor(AUTHOR);
    const xml = DOC('<section><title>S</title><p>one two</p></section>');
    const { update, serialize, scan, originMap } = open(xml);
    update(() => {
      const t = $findText($getRoot(), 'one two')!;
      t.select(4, 4);
      expect($trackedParagraphSplit($sel(), originMap).status).toBe('ok');
    });
    const changes = scan();
    expect(changes.map(c => c.kind)).toEqual(['split']);
    const id = changes[0].changeId;
    const out = serialize();
    expect(out).toContain(`<p>one <?ezd-review-start ${id}:ct-split:${AUTHOR}:`);
    expect(out).toContain(`?></p><p><?ezd-review-end ${id}?>two</p></section>`);
  });
});

// ─── Finding 5 — a replace pair with one unmodelled half ─────────────────────

describe('review finding 5 — the unsupported list is keyed by changeId + kind', () => {
  it('a ct-del half the carrier cannot model is listed even though the ct-ins half became a mark', () => {
    // The struck original holds an element inside an element — not a shape the
    // carrier models (a text-only <b>old</b> would be).
    const xml = DOC(`<p>A <?ezd-review-start r1:ct-ins:${AUTHOR}:5?>new<?ezd-review-end r1?><?ezd-review-start r1:ct-del:${AUTHOR}:4?><b>o<i>ld</i></b><?ezd-review-end r1?> B.</p>`);
    const { scan, serialize } = open(xml);
    const changes = scan();
    expect(changes.map(c => `${c.kind}:${c.text}`)).toEqual(['insert:new']);
    expect(listUnsupportedSuggestions(xml, mappedKeys(changes))).toEqual([
      { changeId: 'r1', kind: 'ct-del', author: AUTHOR, dateMs: 4 },
    ]);
    expect(serialize()).toBe(xml);
  });

  it('a text-only formatted half IS modelled: Heretto\'s replace of a bold word is two marks', () => {
    const xml = DOC(`<p>A <?ezd-review-start r1:ct-ins:${AUTHOR}:5?>new<?ezd-review-end r1?><?ezd-review-start r1:ct-del:${AUTHOR}:4?><b>old</b><?ezd-review-end r1?> B.</p>`);
    const { scan, serialize } = open(xml);
    expect(scan().map(c => `${c.kind}:${c.text}`)).toEqual(['insert:new', 'delete:old']);
    expect(serialize()).toBe(xml);
  });
});

// ─── Finding 6 — no orphan review PI leaves the serializer ───────────────────

describe('review finding 6 — orphan suggestion PIs are never written', () => {
  it('an orphan the SOURCE already has is Heretto\'s data: kept byte for byte, edited or not', () => {
    const xml = DOC(`<p><?ezd-review-start 9:ct-ins:${AUTHOR}:1?>Already orphaned here.</p><p>Keep <?ezd-review-start c1:comment:${AUTHOR}:2?>this<?ezd-review-end c1?> note.</p>`);
    const { update, serialize } = open(xml);
    expect(serialize()).toBe(xml);
    update(() => {
      const t = $findText($getRoot(), 'note')!;
      t.setTextContent(t.getTextContent().replace('note.', 'note!'));
    });
    expect(serialize()).toBe(xml.replace('note.', 'note!'));
  });

  it('a straddling pair whose <b> is edited survives whole (BUG-49 fix: the PI inside the <b> is an atom)', () => {
    const xml = DOC(`<p><?ezd-review-start 9:ct-ins:${AUTHOR}:1?><b class="+ topic/ph hi-d/b "><?ezd-review-end 9?>One</b> sentence.</p>`);
    const { update, serialize, scan } = open(xml);
    expect(scan()).toEqual([]);
    expect(serialize()).toBe(xml);
    update(() => {
      const t = $findText($getRoot(), 'One')!;
      t.setTextContent('Once');
    });
    expect(serialize()).toBe(xml.replace('One</b>', 'Once</b>'));
  });

  it('a legacy full rewrite (a comment inside the changed run forces it) never leaves one half of a pair behind', () => {
    const xml = DOC(`<p><?ezd-review-start 9:ct-ins:${AUTHOR}:1?><b><?ezd-review-end 9?>One</b> two <!-- c --> three.</p>`);
    const { update, serialize } = open(xml);
    update(() => {
      const t = $findText($getRoot(), 'two')!;
      t.setTextContent(t.getTextContent().replace('two  three.', 'twothree.'));
    });
    const out = serialize();
    const starts = (out.match(/ezd-review-start/g) ?? []).length;
    const ends = (out.match(/ezd-review-end/g) ?? []).length;
    expect(starts).toBe(ends);
    expect(out).toContain('twothree.');
  });

  it('the legacy full-rewrite path keeps a comment pair whole (a comment inside the changed run forces it)', () => {
    const xml = DOC(`<p>Alpha <?ezd-review-start c1:comment:${AUTHOR}:2?>beta<?ezd-review-end c1?> gamma.</p>`);
    const { update, serialize } = open(xml);
    update(() => {
      const t = $findText($getRoot(), 'beta')!;
      t.setTextContent(t.getTextContent().replace('Alpha beta gamma.', 'Alpha gamma.'));
    });
    const out = serialize();
    const starts = (out.match(/ezd-review-start/g) ?? []).length;
    const ends = (out.match(/ezd-review-end/g) ?? []).length;
    expect(starts).toBe(ends);
  });
});
