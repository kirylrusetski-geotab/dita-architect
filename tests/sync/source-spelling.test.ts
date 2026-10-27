// @vitest-environment jsdom
//
// BUG-31 / ADR-012 — the serializer writes the whole cloned document with one
// XMLSerializer pass, which re-spells markup no edit touched: <x></x> becomes
// <x/>, &#160; becomes the literal character. restoreSourceSpelling puts the
// source's spelling back wherever a token is unchanged in meaning, and only
// there. Invariants B3–B6 of ADR-012 (B1 is byte-stability.test.ts, B2 the
// edit fuzz). Written before the module.
import { describe, it, expect } from 'vitest';
import { $getRoot, $isElementNode, $isTextNode, type LexicalNode, type TextNode } from 'lexical';
import { createTestEditor } from '../helpers/createTestEditor';
import { parseXmlToLexical } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../../sync/nodeOriginMap';
import { restoreSourceSpelling } from '../../sync/source-spelling';

/** The tree as XMLSerializer sees it: equal strings mean the same document. */
const tree = (xml: string): string =>
  new XMLSerializer().serializeToString(new DOMParser().parseFromString(xml, 'text/xml'));

/** Restore, and check the safety property on every case: same tree as the output. */
const restore = (output: string, source: string): string => {
  const out = restoreSourceSpelling(output, source);
  expect(tree(out)).toBe(tree(output));
  return out;
};

describe('restoreSourceSpelling — unchanged markup takes the source spelling', () => {
  it('identical input is returned as is', () => {
    const xml = '<a><b class="x">t</b></a>';
    expect(restore(xml, xml)).toBe(xml);
  });

  it('an empty element the source wrote open/close', () => {
    expect(restore('<a><x c="1"/><y/></a>', '<a><x c="1"></x><y></y></a>')).toBe('<a><x c="1"></x><y></y></a>');
  });

  it('a numeric character reference', () => {
    expect(restore('<a>A  and B</a>', '<a>A&#160; and B</a>')).toBe('<a>A&#160; and B</a>');
  });

  it('a > the source left unescaped in text', () => {
    expect(restore('<a>x &gt; y</a>', '<a>x > y</a>')).toBe('<a>x > y</a>');
  });

  it('attribute quoting and spacing', () => {
    expect(restore('<a b="1" c="it&apos;s">t</a>', "<a  b='1'\n   c=\"it's\" >t</a>")).toBe("<a  b='1'\n   c=\"it's\" >t</a>");
  });

  it('attribute order is part of a tag: a reordered tag keeps the serializer spelling', () => {
    expect(restore('<a c="2" b="1"/>', '<a b="1" c="2"/>')).toBe('<a c="2" b="1"/>');
  });

  it('CRLF line ends', () => {
    expect(restore('<a>\n<b/>\n</a>', '<a>\r\n<b/>\r\n</a>')).toBe('<a>\r\n<b/>\r\n</a>');
  });

  it('comments, PIs, and CDATA', () => {
    const src = '<a><!-- c --><?pi data?><![CDATA[x < y]]></a>';
    expect(restore(src, src)).toBe(src);
  });

  it('trailing whitespace after the root element', () => {
    expect(restore('<a><b/></a>', '<a><b/></a>\n')).toBe('<a><b/></a>\n');
  });
});

describe('restoreSourceSpelling — changed markup keeps the serializer spelling', () => {
  it('an edited text run (B4): its &#160; is written as the character', () => {
    expect(restore('<a>A B more</a>', '<a>A&#160;B</a>')).toBe('<a>A B more</a>');
  });

  it('a tag whose attribute value changed; its unchanged neighbours keep the source spelling', () => {
    expect(restore('<a><x k="2"/><y/></a>', "<a><x k='1'></x><y></y></a>")).toBe('<a><x k="2"/><y></y></a>');
  });

  it('the edited paragraph keeps its own start and end tags', () => {
    expect(restore('<a><p class="x">Hello there</p></a>', "<a><p  class='x' >Hello</p></a>")).toBe("<a><p  class='x' >Hello there</p></a>");
  });

  it('content added to a source-self-closed element (B5)', () => {
    expect(restore('<a><x>new</x></a>', '<a><x/></a>')).toBe('<a><x>new</x></a>');
  });

  it('an element added beside unchanged ones', () => {
    expect(restore('<a><x/><n>new</n><y/></a>', '<a><x></x><y></y></a>')).toBe('<a><x></x><n>new</n><y></y></a>');
  });

  it('an element removed between unchanged ones', () => {
    expect(restore('<a><x/><y/></a>', '<a><x></x><gone>t</gone><y></y></a>')).toBe('<a><x></x><y></y></a>');
  });

  it('malformed source markup (B6): the output is returned unchanged', () => {
    expect(restoreSourceSpelling('<a><x/></a>', '<a <x></x></a>')).toBe('<a><x/></a>');
  });

  it('an unknown named entity in the source: that token keeps the output spelling', () => {
    expect(restoreSourceSpelling('<a><x/>t</a>', '<a><x></x>&custom;</a>')).toBe('<a><x></x>t</a>');
  });
});

describe('restoreSourceSpelling — randomized: one DOM change, every other byte from the source', () => {
  // Deterministic PRNG (mulberry32) so a failure is reproducible.
  const rng = (seed: number) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /** A root with N uniquely-identified children, each spelled one of several
   *  equivalent ways; returns the source and each child's [start, end). */
  const build = (rand: () => number, n: number) => {
    let xml = '<root>';
    const spans: Array<[number, number]> = [];
    /** The child's start tag as the source spells it; null when self-closed. */
    const openTags: Array<string | null> = [];
    for (let k = 0; k < n; k++) {
      const start = xml.length;
      const form = Math.floor(rand() * 5);
      const open = form === 2 ? `<e  id="k${k}" >` : form === 1 ? null : `<e id="k${k}">`;
      if (form === 0) xml += `${open}</e>`;
      else if (form === 1) xml += `<e id='k${k}'/>`;
      else if (form === 2) xml += `${open}t&#160;${k}</e>`;
      else if (form === 3) xml += `${open}a &gt; b ${k}</e>`;
      else xml += `${open}<i></i>x${k}</e>`;
      spans.push([start, xml.length]);
      openTags.push(open);
      if (rand() < 0.3) xml += '\n  ';
    }
    return { xml: `${xml}</root>`, spans, openTags };
  };

  it('200 deletions, insertions, and text edits', () => {
    const rand = rng(31);
    for (let iter = 0; iter < 200; iter++) {
      const { xml, spans, openTags } = build(rand, 5 + Math.floor(rand() * 40));
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const kids = Array.from(doc.documentElement.children);
      const k = Math.floor(rand() * kids.length);
      const op = Math.floor(rand() * 3);
      let expected: string;
      if (op === 0) {
        kids[k].remove();
        expected = xml.slice(0, spans[k][0]) + xml.slice(spans[k][1]);
      } else if (op === 1) {
        doc.documentElement.insertBefore(doc.createElement('new'), kids[k]);
        expected = xml.slice(0, spans[k][0]) + '<new/>' + xml.slice(spans[k][0]);
      } else {
        // Change the child's content. Its start tag is unchanged in meaning, so
        // it keeps the source spelling — unless the source self-closed it,
        // which cannot hold content (B5). The end tag is the source's when it
        // had one.
        const repl = doc.createElement('e');
        repl.setAttribute('id', `k${k}`);
        repl.textContent = 'changed';
        kids[k].replaceWith(repl);
        const open = openTags[k];
        const rewritten = open ? `${open}changed</e>` : `<e id="k${k}">changed</e>`;
        expected = xml.slice(0, spans[k][0]) + rewritten + xml.slice(spans[k][1]);
      }
      const output = new XMLSerializer().serializeToString(doc);
      expect(restore(output, xml), `iteration ${iter}, op ${op}, child ${k}`).toBe(expected);
    }
  });
});

// ─── Through the serializer ─────────────────────────────────────────────────

const DOC = (prolog: string, body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="c"><title>T</title>${prolog}<conbody>${body}</conbody></concept>\n`;

function findText(node: LexicalNode, needle: string): TextNode | null {
  if ($isTextNode(node) && node.getTextContent() === needle) return node;
  if ($isElementNode(node)) for (const c of node.getChildren()) { const r = findText(c, needle); if (r) return r; }
  return null;
}

function serialize(xml: string, edit?: [string, string]): string {
  const editor = createTestEditor();
  const originMap = createNodeOriginMap();
  parseXmlToLexical(xml, editor, originMap, true);
  if (edit) {
    editor.update(() => {
      const t = findText($getRoot(), edit[0]);
      if (!t) throw new Error(`no text node is exactly "${edit[0]}"`);
      t.setTextContent(edit[1]);
    }, { discrete: true });
  }
  return serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
}

const PROLOG = '<prolog><metadata><keywords><keyword class="- topic/keyword "></keyword></keywords><prodname></prodname></metadata></prolog>';

describe('BUG-31 — through the serializer', () => {
  it('unedited: the prolog empty elements and the trailing newline are byte-identical', () => {
    const xml = DOC(PROLOG, '<p>One.</p>');
    expect(serialize(xml)).toBe(xml);
  });

  it('after a body edit, the prolog keeps its source spelling (B3)', () => {
    const xml = DOC(PROLOG, '<p>One.</p>');
    expect(serialize(xml, ['One.', 'One more.'])).toBe(xml.replace('One.', 'One more.'));
  });

  it('after an edit in another paragraph, an &#160; stays a reference (B3)', () => {
    const xml = DOC('', '<p>A&#160; B</p><p>Two.</p>');
    expect(serialize(xml, ['Two.', 'Two more.'])).toBe(xml.replace('Two.', 'Two more.'));
  });

  it('an &#160; in an unedited text run of the edited paragraph stays a reference (B3)', () => {
    const xml = DOC('', '<p>A&#160;B <b>x</b></p>');
    expect(serialize(xml, ['x', 'xy'])).toBe(xml.replace('<b>x</b>', '<b>xy</b>'));
  });

  it("the edited paragraph's own start tag keeps its source spelling (B3)", () => {
    const xml = DOC('', "<p  class='x' >Hello</p>");
    expect(serialize(xml, ['Hello', 'Hello there'])).toBe(xml.replace('Hello', 'Hello there'));
  });

  it('an edited text run takes the serializer spelling (B4)', () => {
    const xml = DOC('', '<p>A&#160;B</p>');
    expect(serialize(xml, ['A B', 'A B more'])).toBe(xml.replace('A&#160;B', 'A B more'));
  });
});
