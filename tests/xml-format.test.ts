// @vitest-environment jsdom
//
// BUG-45 — formatXml (the Format button, Shift+Alt+F, and — until BUG-45 — every
// load path) changed text: it trimmed every text run and put any element not
// on its inline list on its own line, so "H<sub>2</sub>O" read "H 2 O", a
// Heretto review PI mid-sentence doubled the spaces around it, a <codeblock>
// lost its first-line indentation, and an empty element got whitespace inside
// it. Measured over the corpus: the editor showed different text for 7 of 52
// fixtures. The rule now: whitespace moves only between the children of an
// element whose children are all known block elements and that holds no text
// of its own; every other element is copied verbatim. Written before the fix.
// (tests/xml-utils.test.ts mocks formatXml for compareXml; this file tests the
// real function.)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { $getRoot } from 'lexical';
import { createTestEditor } from './helpers/createTestEditor';
import { parseXmlToLexical } from '../sync/parseXmlToLexical';
import { createNodeOriginMap } from '../sync/nodeOriginMap';
import { formatXml } from '../lib/xml-utils';

const FIXTURES = join(__dirname, 'sync', 'fixtures');
const list = (d: string): string[] =>
  readdirSync(d).flatMap(e => {
    const f = join(d, e);
    return statSync(f).isDirectory() ? list(f) : e.endsWith('.dita') ? [f] : [];
  }).sort();

/** What the visual editor shows: each top-level block's type and text. */
const shown = (xml: string): string[] => {
  const editor = createTestEditor();
  parseXmlToLexical(xml, editor, createNodeOriginMap(), true);
  return editor.getEditorState().read(() => $getRoot().getChildren().map(c => `${c.getType()}|${c.getTextContent()}`));
};

/** Every element that holds text of its own, serialized, in document order. */
const textHolders = (xml: string): string[] => {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const out: string[] = [];
  const s = new XMLSerializer();
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    if (Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && (n.textContent || '').trim())) out.push(s.serializeToString(el));
  }
  return out;
};

const doc = (body: string) => `<concept id="c"><title>T</title><conbody>${body}</conbody></concept>`;

describe('formatXml never changes text — the corpus', () => {
  const files = list(FIXTURES);
  it('the corpus is there', () => { expect(files.length).toBeGreaterThan(40); });
  for (const f of files) {
    const rel = f.slice(FIXTURES.length + 1);
    it(`${rel}: the editor shows the same text; every text-holding element is byte-identical; idempotent`, () => {
      const src = readFileSync(f, 'utf-8');
      const fmt = formatXml(src);
      expect(shown(fmt)).toEqual(shown(src));
      expect(textHolders(fmt)).toEqual(textHolders(src));
      expect(formatXml(fmt)).toBe(fmt);
    });
  }
});

describe('formatXml never changes text — the cases that broke', () => {
  const cases: Array<[string, string]> = [
    ['an inline element not on any list (<sub>)', doc('<p>H<sub>2</sub>O is water.</p>')],
    ['Heretto review PIs mid-sentence', doc('<p>Click <?ezd-review-start id="1"?>Save<?ezd-review-end id="1"?> now.</p>')],
    ['an inline <image> and <u>', doc('<p>See <image href="a.png"/> here and <u>this</u>.</p>')],
    ['a comment inside text', doc('<p>Text <!-- note --> more.</p>')],
    ['a <codeblock> with leading indentation and a trailing newline', doc('<codeblock>  indented first\n    second\n</codeblock>')],
    ['a <pre>', doc('<pre>a\n  b</pre>')],
    ['direct text in a block that also holds blocks', doc('<li>Lead <p>para</p> tail</li>')],
    ['spaces at the edges of a cell', doc('<simpletable><strow><stentry> padded </stentry></strow></simpletable>')],
  ];
  for (const [name, xml] of cases) {
    it(name, () => {
      const fmt = formatXml(xml);
      expect(shown(fmt)).toEqual(shown(xml));
      expect(textHolders(fmt)).toEqual(textHolders(xml));
    });
  }

  it('a <codeblock> is copied byte for byte', () => {
    const xml = doc('<codeblock>  indented first\n    second\n</codeblock>');
    expect(formatXml(xml)).toContain('<codeblock>  indented first\n    second\n</codeblock>');
  });

  it('an empty element stays empty', () => {
    const xml = '<concept id="c"><title>T</title><prolog><metadata><prodinfo><prodname></prodname></prodinfo></metadata></prolog></concept>';
    expect(formatXml(xml)).toContain('<prodname></prodname>');
  });
});

describe('formatXml still formats', () => {
  it('block structure is indented, one element per line; text-holding elements stay on one line', () => {
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n' +
      '<concept id="c"><title>T</title><conbody><p>a</p><p>b <b>c</b></p><ul><li>one</li><li>two</li></ul><note><p>n</p></note></conbody></concept>';
    expect(formatXml(xml)).toBe([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">',
      '<concept id="c">',
      '  <title>T</title>',
      '  <conbody>',
      '    <p>a</p>',
      '    <p>b <b>c</b></p>',
      '    <ul>',
      '      <li>one</li>',
      '      <li>two</li>',
      '    </ul>',
      '    <note>',
      '      <p>n</p>',
      '    </note>',
      '  </conbody>',
      '</concept>',
    ].join('\n'));
  });

  it('re-indents an already indented document to the same layout (whitespace between blocks only)', () => {
    const messy = '<concept id="c">\n<title>T</title>\n      <conbody>\n<p>a</p>\n\n\n   <p>b</p></conbody>\n</concept>';
    expect(formatXml(messy)).toBe('<concept id="c">\n  <title>T</title>\n  <conbody>\n    <p>a</p>\n    <p>b</p>\n  </conbody>\n</concept>');
  });

  it('a comment or PI between blocks goes on its own line', () => {
    const xml = doc('<p>a</p><!-- c --><?ezd-review-start id="2"?><p>b</p><?ezd-review-end id="2"?>');
    expect(formatXml(xml)).toBe([
      '<concept id="c">',
      '  <title>T</title>',
      '  <conbody>',
      '    <p>a</p>',
      '    <!-- c -->',
      '    <?ezd-review-start id="2"?>',
      '    <p>b</p>',
      '    <?ezd-review-end id="2"?>',
      '  </conbody>',
      '</concept>',
    ].join('\n'));
  });

  it('malformed XML is returned unchanged', () => {
    const bad = '<concept id="c"><title>T</title><conbody><p>open</conbody></concept>';
    expect(formatXml(bad)).toBe(bad);
  });
});
