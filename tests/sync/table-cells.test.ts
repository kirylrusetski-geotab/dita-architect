// @vitest-environment jsdom
//
// BUG-29 — table cells are block wrappers (ADR-009 amendment, v0.10.2).
// Invariants T1–T6, written before the implementation. Every expectation is a
// full-string comparison against the source with exactly the edited text
// replaced, so a dropped wrapper, a lost attribute, or a moved word fails.
//
// The cell shapes are the five found in the sampled corpus (image + <p>,
// <note>, <p> + <dl>, <p> + <note>, loose text + <p>), in the corpus' own
// formatting, plus the block kinds the shared cell parser now models (fig,
// codeblock) and the ordinary cells that must not change.
import { describe, it, expect } from 'vitest';
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  $isElementNode,
  $isTextNode,
  type ElementNode,
  type LexicalNode,
  type TextNode,
} from 'lexical';
import { $createListNode, $createListItemNode } from '@lexical/list';
import { createTestEditor } from '../helpers/createTestEditor';
import { parseXmlToLexical } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap, type NodeOriginMapType } from '../../sync/nodeOriginMap';
import { checkSerializedStructure } from '../../sync/structure-check';

const DOC = (table: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="c"><title>T</title><conbody>${table}</conbody></concept>`;

type Kind = 'entry' | 'stentry';
const KINDS: Kind[] = ['entry', 'stentry'];

const OPEN: Record<Kind, string> = { entry: '<entry class="- topic/entry "', stentry: '<stentry class="- topic/stentry "' };

/** One table (CALS or simple) holding `cell` and a plain control cell. An
 *  empty cell is written self-closed: XMLSerializer writes `<x></x>` as
 *  `<x/>` everywhere (BUG-31, a separate cosmetic bug). */
const TABLE = (kind: Kind, cell: string): string => {
  const c = cell === '' ? `${OPEN[kind]}/>` : `${OPEN[kind]}>${cell}</${kind}>`;
  return kind === 'entry'
    ? DOC(`<table><tgroup cols="2"><tbody><row>${c}<entry>Control</entry></row></tbody></tgroup></table>`)
    : DOC(`<simpletable><strow>${c}<stentry>Control</stentry></strow></simpletable>`);
};

// ─── Cell shapes ─────────────────────────────────────────────────────────────

const SHAPES: Record<string, string> = {
  // concept/installing-the-go-anywhere.dita
  'image + p (formatted)':
    ' <image align="left" height="48" href="Images/led_flashing_green.png" outputclass="no-shadow" width="48" class="- topic/image "/>\n' +
    '                                    <p class="- topic/p ">Flashing green</p>\n                                ',
  'image + p (compact)':
    '<image align="left" height="48" href="Images/led_solid_red.png" outputclass="no-shadow" width="48" class="- topic/image "/><p class="- topic/p ">Solid red</p>',
  'loose text + p':
    ' Activation failed. Check the cell network, then retry. <p class="- topic/p ">Re-apply the magnetic strip for 5 seconds. </p>',
  // topic/altitude-notes-warehouse.dita
  'note with id and p (formatted)':
    '\n                                    <note id="noteFilters" class="- topic/note ">\n' +
    '                                        <p class="- topic/p ">This category is not part of <ph conkeyref="varsAltitude/ProdNameShort" class="- topic/ph "/> filters outside of Expansion.</p>\n' +
    '                                    </note>\n                                ',
  'note with direct inline content':
    '\n                                    <note id="noteSDK" type="note" class="- topic/note ">The examples use the <codeph class="+ topic/ph pr-d/codeph ">altitude-sdk</codeph> package. For REST calls, see <xref href="https://example.com/api#post" scope="external" class="- topic/xref ">Making a POST request</xref>.</note>\n                                ',
  // reference/platform-terms-and-definitions.dita
  'p + dl (formatted)':
    '\n                            <p class="- topic/p ">Describes the idle duration of a vehicle. This includes the following API terms: </p>\n' +
    '                            <dl class="- topic/dl "><dlentry class="- topic/dlentry "><dt class="- topic/dt ">IdleDurationAvg</dt><dd class="- topic/dd ">The average idle duration during the stop</dd></dlentry><dlentry class="- topic/dlentry "><dt class="- topic/dt ">IdleDurationMed</dt><dd class="- topic/dd ">The median idle duration before turning off ignition.</dd></dlentry></dl>\n                        ',
  // topic/altitude-api-reuse.dita
  'p + note':
    '\n                                <p class="- topic/p ">An indicator of whether to generate a time series breakdown.</p>\n' +
    '                                <note class="- topic/note "><p class="- topic/p ">The results can be retrieved using the <codeph class="+ topic/ph pr-d/codeph ">getSavedResults</codeph> API. See <ph conkeyref="varsAltitudeXREF/AltitudeTSR" class="- topic/ph "/> .</p></note>\n                            ',
  // Block kinds the shared cell parser now models.
  'fig + p': '<fig><title>LED states</title><image href="Images/led.png"/></fig><p>Caption text</p>',
  'p + codeblock': '<p>Run the suite:</p><codeblock outputclass="bash">npm test</codeblock>',
  'loose text + note': 'Text before the note <note>Short note</note>',
};

// Ordinary cells: one inline run, <p>s only, <p> + <ul> (BUG-35), empty.
const ORDINARY: Record<string, string> = {
  'one inline run': 'Set with <uicontrol>Chaining</uicontrol>.',
  'one inline run (formatted)': '\n              Minimum stop\n              duration\n            ',
  'p only': '<p>One</p><p>Two</p>',
  'p only (formatted)': '\n              <p class="- topic/p ">First</p>\n              <p class="- topic/p ">Second</p>\n            ',
  'p + ul': '<p>Minimum stop duration.</p><ul><li>Minutes</li><li>Whole numbers only</li></ul>',
  'empty': '',
  'whitespace only': '   ',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function run(xml: string, edit?: (originMap: NodeOriginMapType) => void) {
  const editor = createTestEditor();
  const originMap = createNodeOriginMap();
  parseXmlToLexical(xml, editor, originMap, true);
  if (edit) editor.update(() => edit(originMap), { discrete: true });
  const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
  return { out, mismatches: checkSerializedStructure(editor.getEditorState(), out, originMap), editor, originMap };
}

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

/** Replace `from` with `to` inside the one Lexical text node that contains it. */
function $replaceText(from: string, to: string): void {
  const t = findText($getRoot(), from);
  if (!t) throw new Error(`no text node contains "${from}"`);
  t.setTextContent(t.getTextContent().replace(from, to));
}

/** The first table cell in the document (the cell under test). */
function $cell(): ElementNode {
  const table = $getRoot().getChildren().find(c => c.getType() === 'table');
  if (!table || !$isElementNode(table)) throw new Error('no table');
  const row = table.getFirstChild();
  const cell = row && $isElementNode(row) ? row.getFirstChild() : null;
  if (!cell || !$isElementNode(cell)) throw new Error('no cell');
  return cell;
}

/** `xml` with the one occurrence of `from` replaced by `to`. */
function replaced(xml: string, from: string, to: string): string {
  const parts = xml.split(from);
  if (parts.length !== 2) throw new Error(`"${from}" occurs ${parts.length - 1} times in the source, expected once`);
  return parts.join(to);
}

const $para = (text: string) => { const p = $createParagraphNode(); p.append($createTextNode(text)); return p; };
const $list = (...items: string[]) => {
  const ul = $createListNode('bullet');
  for (const t of items) { const li = $createListItemNode(); li.append($createTextNode(t)); ul.append(li); }
  return ul;
};

// ─── T1 + T5 — every shape, unedited, is byte-stable ─────────────────────────

describe('T1/T5 — every cell shape round-trips byte-for-byte, in <entry> and <stentry>', () => {
  for (const kind of KINDS) {
    for (const [name, cell] of Object.entries({ ...SHAPES, ...ORDINARY })) {
      it(`${kind}: ${name}`, () => {
        const xml = TABLE(kind, cell);
        const { out, mismatches } = run(xml);
        expect(out).toBe(xml);
        expect(mismatches).toEqual([]);
      });
    }
  }
});

// ─── T2 + T5 — an edit inside a cell block changes only that text ────────────

interface Edit { shape: string; from: string; to: string }
const BLOCK_EDITS: Edit[] = [
  { shape: 'note with id and p (formatted)', from: ' filters outside of Expansion.', to: ' filters outside of Expansion today.' },
  { shape: 'note with direct inline content', from: ' package. For REST calls, see ', to: ' package. For plain REST calls, see ' },
  { shape: 'p + dl (formatted)', from: 'The average idle duration during the stop', to: 'The mean idle duration during the stop' },
  { shape: 'p + dl (formatted)', from: 'IdleDurationMed', to: 'IdleDurationMedian' },
  // The parser edge-trims the space before </p>; the source keeps it.
  { shape: 'p + dl (formatted)', from: 'This includes the following API terms:', to: 'It includes these API terms:' },
  { shape: 'p + note', from: 'The results can be retrieved using the ', to: 'The results can be fetched using the ' },
  { shape: 'p + note', from: 'An indicator of whether', to: 'A flag for whether' },
  { shape: 'image + p (formatted)', from: 'Flashing green', to: 'Flashing green quickly' },
  { shape: 'image + p (compact)', from: 'Solid red', to: 'Solid red light' },
  { shape: 'fig + p', from: 'Caption text', to: 'Caption words' },
  { shape: 'p + codeblock', from: 'Run the suite:', to: 'Run the whole suite:' },
];

describe('T2/T5 — an edit inside a cell block changes only that text', () => {
  for (const kind of KINDS) {
    for (const e of BLOCK_EDITS) {
      it(`${kind}: ${e.shape} — "${e.from}" → "${e.to}"`, () => {
        const xml = TABLE(kind, SHAPES[e.shape]);
        const { out, mismatches } = run(xml, () => $replaceText(e.from, e.to));
        expect(out).toBe(replaced(xml, e.from, e.to));
        expect(mismatches).toEqual([]);
      });
    }

    it(`${kind}: p + codeblock — editing the code changes only the code`, () => {
      const xml = TABLE(kind, SHAPES['p + codeblock']);
      const { out } = run(xml, () => {
        const cb = $cell().getChildren().find(c => c.getType() === 'ditacodeblock') as unknown as { setCode(c: string): void } | undefined;
        if (!cb) throw new Error('no codeblock node in the cell');
        cb.setCode('npm run test:edit-fuzz');
      });
      expect(out).toBe(replaced(xml, '>npm test<', '>npm run test:edit-fuzz<'));
    });
  }
});

// ─── T3 + T5 — loose inline text beside a block ──────────────────────────────

const INLINE_EDITS: Edit[] = [
  { shape: 'loose text + p', from: 'then retry.', to: 'then retry once.' },
  { shape: 'loose text + note', from: 'Text before the note', to: 'Words before the note' },
];

describe('T3/T5 — an edit to loose inline text beside a block lands in place', () => {
  for (const kind of KINDS) {
    for (const e of INLINE_EDITS) {
      it(`${kind}: ${e.shape} — "${e.from}" → "${e.to}"`, () => {
        const xml = TABLE(kind, SHAPES[e.shape]);
        const { out, mismatches } = run(xml, () => $replaceText(e.from, e.to));
        expect(out).toBe(replaced(xml, e.from, e.to));
        expect(mismatches).toEqual([]);
      });
    }
  }
});

// ─── T4 + T5 — ordinary cells are byte-identical, edited ─────────────────────

const ORDINARY_EDITS: Edit[] = [
  { shape: 'one inline run', from: 'Set with ', to: 'Set it with ' },
  { shape: 'one inline run (formatted)', from: 'Minimum stop duration', to: 'Minimum stop length' },
  { shape: 'p only', from: 'Two', to: 'Two more' },
  { shape: 'p only (formatted)', from: 'Second', to: 'Second one' },
  { shape: 'p + ul', from: 'Minutes', to: 'Minutes only' },
  { shape: 'p + ul', from: 'Minimum stop duration.', to: 'Minimum stop time.' },
];

describe('T4/T5 — ordinary cells: an edit changes only the edited text', () => {
  for (const kind of KINDS) {
    for (const e of ORDINARY_EDITS) {
      it(`${kind}: ${e.shape} — "${e.from}" → "${e.to}"`, () => {
        const xml = TABLE(kind, ORDINARY[e.shape]);
        const { out } = run(xml, () => $replaceText(e.from, e.to));
        // The formatted inline run is one DOM text node whose newlines the
        // parser collapses; the edit is spliced into the raw text, so the
        // newline before the changed word survives.
        const expected = e.shape === 'one inline run (formatted)'
          ? replaced(xml, '\n              duration', '\n              length')
          : replaced(xml, e.from, e.to);
        expect(out).toBe(expected);
      });
    }

    it(`${kind}: typing into an empty cell writes the text into it`, () => {
      const xml = TABLE(kind, ORDINARY['empty']);
      const { out } = run(xml, () => {
        const p = $cell().getFirstChild();
        if (!p || !$isElementNode(p)) throw new Error('no paragraph in the empty cell');
        p.append($createTextNode('Typed'));
      });
      expect(out).toBe(replaced(xml, `${OPEN[kind]}/>`, `${OPEN[kind]}>Typed</${kind}>`));
    });
  }
});

// ─── T6 + T5 — blocks added to or removed from a cell ────────────────────────

describe('T6/T5 — a block added to or removed from a cell is serialized, in order', () => {
  for (const kind of KINDS) {
    it(`${kind}: a list added after a cell note`, () => {
      const xml = TABLE(kind, SHAPES['note with id and p (formatted)']);
      const { out } = run(xml, () => { $cell().append($list('Added')); });
      expect(out).toBe(replaced(xml, '</note>\n', '</note><ul><li>Added</li></ul>\n'));
    });

    it(`${kind}: a paragraph added after the <p> of an image + <p> cell`, () => {
      const xml = TABLE(kind, SHAPES['image + p (compact)']);
      const { out } = run(xml, () => { $cell().append($para('More')); });
      expect(out).toBe(replaced(xml, 'Solid red</p>', 'Solid red</p><p>More</p>'));
    });

    it(`${kind}: a list added between a <p> and trailing loose text lands before the text`, () => {
      const xml = TABLE(kind, '<p>Intro</p> trailing words');
      const { out } = run(xml, () => {
        const first = $cell().getFirstChild();
        if (!first) throw new Error('empty cell');
        first.insertAfter($list('New'));
      });
      expect(out).toBe(replaced(xml, '<p>Intro</p> trailing', '<p>Intro</p><ul><li>New</li></ul> trailing'));
    });

    it(`${kind}: deleting the note of a <p> + <note> cell removes only the note`, () => {
      const cell = SHAPES['p + note'];
      const xml = TABLE(kind, cell);
      const noteXml = cell.slice(cell.indexOf('<note'), cell.indexOf('</note>') + '</note>'.length);
      const { out } = run(xml, () => {
        const quote = $cell().getChildren().find(c => c.getType() === 'quote');
        if (!quote) throw new Error('no quote node in the cell');
        quote.remove();
      });
      expect(out).toBe(replaced(xml, noteXml, ''));
    });
  }
});

// ─── BUG-40 — a <dd> is the same kind of wrapper ─────────────────────────────
//
// Found while building BUG-29: on v0.10.1 a <dd> holding loose text gained a
// copy of that text as a new <p> on every serialize, edited or not
// (`<dd>a1</dd>` → `<dd>a1<p>a1</p></dd>`). Every body-level <dd> in the
// corpus wraps its text in <p>, so nothing caught it.

const DL = (dd: string) => DOC(`<dl class="- topic/dl "><dlentry class="- topic/dlentry "><dt class="- topic/dt ">Term</dt><dd class="- topic/dd ">${dd}</dd></dlentry></dl>`);

const DD_SHAPES: Record<string, string> = {
  'loose text': 'The average idle duration',
  'loose text with an inline element': 'Click <uicontrol>Save</uicontrol> to keep it.',
  'loose text (formatted)': '\n          The median\n          duration.\n        ',
  'lead text + p': 'Lead text<p>Para text</p>',
  'p only': '<p>First</p><p>Second</p>',
  'p + note': '<p>Body</p><note type="tip">Tip text</note>',
};

describe('BUG-40 — a <dd> with loose content round-trips and edits in place', () => {
  for (const [name, dd] of Object.entries(DD_SHAPES)) {
    it(`unedited: ${name}`, () => {
      const xml = DL(dd);
      const { out, mismatches } = run(xml);
      expect(out).toBe(xml);
      expect(mismatches).toEqual([]);
    });
  }

  const DD_EDITS: Edit[] = [
    { shape: 'loose text', from: 'The average idle duration', to: 'The mean idle duration' },
    { shape: 'loose text with an inline element', from: ' to keep it.', to: ' to keep it safe.' },
    { shape: 'lead text + p', from: 'Lead text', to: 'Leading text' },
    { shape: 'lead text + p', from: 'Para text', to: 'Paragraph text' },
    { shape: 'p only', from: 'Second', to: 'Second one' },
    { shape: 'p + note', from: 'Tip text', to: 'Tip words' },
  ];
  for (const e of DD_EDITS) {
    it(`edited: ${e.shape} — "${e.from}" → "${e.to}"`, () => {
      const xml = DL(DD_SHAPES[e.shape]);
      const { out, mismatches } = run(xml, () => $replaceText(e.from, e.to));
      expect(out).toBe(replaced(xml, e.from, e.to));
      expect(mismatches).toEqual([]);
    });
  }

  it('the term is untouched when only the definition changes, and vice versa', () => {
    const xml = DL(DD_SHAPES['loose text']);
    expect(run(xml, () => $replaceText('Term', 'Word')).out).toBe(replaced(xml, '>Term<', '>Word<'));
  });
});

// ─── The editor shows cell blocks as blocks ──────────────────────────────────

describe('cell blocks parse to the same nodes as body blocks', () => {
  const types = (cell: string) => {
    const { editor, originMap } = run(TABLE('entry', cell));
    return editor.getEditorState().read(() =>
      $cell().getChildren().map(c => `${c.getType()}:${originMap.get(c.getKey())?.tag ?? '-'}`));
  };

  it('a <note> is a quote; loose content and <p> paragraphs are stamped apart', () => {
    expect(types(SHAPES['note with id and p (formatted)'])).toEqual(['quote:note']);
    expect(types(SHAPES['image + p (compact)'])).toEqual(['paragraph:cell-inline', 'paragraph:p']);
    expect(types(SHAPES['loose text + p'])).toEqual(['paragraph:cell-inline', 'paragraph:p']);
    expect(types(ORDINARY['one inline run'])).toEqual(['paragraph:cell-inline']);
    expect(types(ORDINARY['empty'])).toEqual(['paragraph:cell-inline']);
  });

  it('a <dl> is dt/dd paragraphs; a <fig> is an image node; a <codeblock> is a code block', () => {
    expect(types(SHAPES['p + dl (formatted)'])).toEqual(['paragraph:p', 'paragraph:dt', 'paragraph:dd', 'paragraph:dt', 'paragraph:dd']);
    expect(types(SHAPES['fig + p'])[0]).toBe('ditaimage:-');
    expect(types(SHAPES['p + codeblock'])).toEqual(['paragraph:p', 'ditacodeblock:-']);
  });
});
