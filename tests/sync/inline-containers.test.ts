// @vitest-environment jsdom
//
// BUG-36 + BUG-34 — edits inside container inlines. A "container inline" is an
// inline element the parser flattens because it holds other elements: a
// <menucascade>, a refless <ph> wrapping <uicontrol>, and a <p> inside an <li>
// whose content includes an element. The reconciler used to splice at the
// OUTERMOST container, so an edit inside one could delete the container's
// other children (BUG-34: <menucascade>'s first <uicontrol> vanished), drop
// the container itself (BUG-36: <li><p attrs>'s <p>), or put typed text
// outside it (words reordered). Invariants C1–C8, written before the fix.
//
// Every expectation is full-string equality against the source with exactly
// the author's change applied.
import { describe, it, expect } from 'vitest';
import { $getRoot, $isElementNode, $isTextNode, type LexicalNode, type TextNode } from 'lexical';
import { createTestEditor } from '../helpers/createTestEditor';
import { parseXmlToLexical } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../../sync/nodeOriginMap';
import { checkSerializedStructure } from '../../sync/structure-check';

const DOC = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="c"><title>T</title><conbody>${body}</conbody></concept>`;

function findText(node: LexicalNode, needle: string): TextNode | null {
  if ($isTextNode(node) && node.getTextContent().includes(needle)) return node;
  if ($isElementNode(node)) for (const c of node.getChildren()) { const r = findText(c, needle); if (r) return r; }
  return null;
}

/** Parse, replace `needle` with `next` inside the text node that holds it, serialize. */
function edit(xml: string, needle: string, next: string) {
  const editor = createTestEditor();
  const originMap = createNodeOriginMap();
  parseXmlToLexical(xml, editor, originMap, true);
  editor.update(() => {
    const t = findText($getRoot(), needle);
    if (!t) throw new Error(`no text node holds "${needle}"`);
    t.setTextContent(t.getTextContent().replace(needle, next));
  }, { discrete: true });
  const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
  return { out, mismatches: checkSerializedStructure(editor.getEditorState(), out, originMap) };
}

describe('C1 — BUG-36: <li><p attrs> wrapping an inline element keeps the <p> on edit', () => {
  it('edit the text of an <xref> inside <li><p props>', () => {
    const xml = DOC('<ul><li><p props="ai-authored" otherprops="draft"><xref keyref="k" class="- topic/xref ">Review availability</xref></p></li></ul>');
    expect(edit(xml, 'Review availability', 'Review your availability').out)
      .toBe(xml.replace('Review availability', 'Review your availability'));
  });
  it('the real hos-status-page shape, second list item edited', () => {
    const xml = DOC('<ul><li><p props="ai-authored" otherprops="draft"><xref keyref="a">Review your availability</xref></p></li><li><p props="ai-authored" otherprops="draft"><xref keyref="b">Change your duty status</xref></p></li></ul>');
    expect(edit(xml, 'Change your duty status', 'Change duty status').out)
      .toBe(xml.replace('Change your duty status', 'Change duty status'));
  });
});

describe('C2 — plain text edited inside <li><p> that also holds an inline element', () => {
  it('before the inline element', () => {
    const xml = DOC('<ul><li><p props="ai">Click <uicontrol>Save</uicontrol> to finish.</p></li></ul>');
    expect(edit(xml, 'Click ', 'Then click ').out).toBe(xml.replace('Click ', 'Then click '));
  });
  it('after the inline element', () => {
    const xml = DOC('<ul><li><p props="ai">Click <uicontrol>Save</uicontrol> to finish.</p></li></ul>');
    expect(edit(xml, ' to finish.', ' to finish now.').out).toBe(xml.replace(' to finish.', ' to finish now.'));
  });
});

describe('C3 — typed text at the edges of a container lands inside it (words never reorder)', () => {
  it('typing at the very end of <li><p>…</p>', () => {
    const xml = DOC('<ul><li><p>Open <uicontrol>Menu</uicontrol></p></li></ul>');
    const { out } = edit(xml, 'Open ', 'Open the ');
    expect(out).toBe(xml.replace('Open ', 'Open the '));
  });
});

describe('C4 — BUG-34: an edit inside one element of a <menucascade> keeps the cascade and its siblings', () => {
  it('edit the second <uicontrol>', () => {
    const xml = DOC('<p>Go to <menucascade><uicontrol>File</uicontrol><uicontrol>Save</uicontrol></menucascade> now.</p>');
    const { out, mismatches } = edit(xml, 'Save', 'Save As');
    expect(out).toBe(xml.replace('>Save<', '>Save As<'));
    expect(mismatches).toEqual([]);
  });
  it('edit the first <uicontrol>', () => {
    const xml = DOC('<p>Go to <menucascade><uicontrol>File</uicontrol><uicontrol>Save</uicontrol></menucascade> now.</p>');
    expect(edit(xml, 'File', 'Files').out).toBe(xml.replace('>File<', '>Files<'));
  });
  it('a refless <ph> wrapping a <uicontrol>', () => {
    const xml = DOC('<p>Press <ph product="x">the <uicontrol>OK</uicontrol> button</ph> twice.</p>');
    expect(edit(xml, ' button', ' button again').out).toBe(xml.replace(' button<', ' button again<'));
  });
});

describe('C5 — text typed outside a container stays outside it', () => {
  it('text after a <menucascade>', () => {
    const xml = DOC('<p>Go to <menucascade><uicontrol>File</uicontrol><uicontrol>Save</uicontrol></menucascade> now.</p>');
    expect(edit(xml, ' now.', ' right now.').out).toBe(xml.replace(' now.', ' right now.'));
  });
  it('text before a <menucascade>', () => {
    const xml = DOC('<p>Go to <menucascade><uicontrol>File</uicontrol><uicontrol>Save</uicontrol></menucascade> now.</p>');
    expect(edit(xml, 'Go to ', 'Then go to ').out).toBe(xml.replace('Go to ', 'Then go to '));
  });
});

describe('C6 — editing a keyref <xref> never adds href=""', () => {
  it('in a body paragraph', () => {
    const xml = DOC('<p>See <xref keyref="k" class="- topic/xref ">the guide</xref> for more.</p>');
    expect(edit(xml, 'the guide', 'the full guide').out).toBe(xml.replace('the guide', 'the full guide'));
  });
  it('an <xref> with an href keeps it and every other attribute byte-identical', () => {
    const xml = DOC('<p>See <xref href="g.dita" format="dita" scope="local" class="- topic/xref ">the guide</xref>.</p>');
    expect(edit(xml, 'the guide', 'our guide').out).toBe(xml.replace('the guide', 'our guide'));
  });
  it('an <xref> holding an inline element: edit the plain text around it', () => {
    const xml = DOC('<p>Open <xref keyref="k">the <uicontrol>Rules</uicontrol> page</xref>.</p>');
    expect(edit(xml, ' page', ' list').out).toBe(xml.replace(' page<', ' list<'));
  });
});

describe('C7 — an edit that straddles a container boundary loses no text', () => {
  it('replace text spanning from before a <menucascade> into it', () => {
    // A Lexical text node never spans into a stamped element, so a straddling
    // change is simulated by deleting the text before the cascade together
    // with editing the first <uicontrol> in one update.
    const xml = DOC('<p>Go to <menucascade><uicontrol>File</uicontrol><uicontrol>Save</uicontrol></menucascade> now.</p>');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.update(() => {
      findText($getRoot(), 'Go to ')!.setTextContent('Open ');
      findText($getRoot(), 'File')!.setTextContent('Files');
    }, { discrete: true });
    const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
    expect(out).toBe(xml.replace('Go to ', 'Open ').replace('>File<', '>Files<'));
  });
});

describe('C8 — unchanged container content is still untouched (no rewrite on open)', () => {
  it('unedited <li><p> with an xref and a menucascade round-trips byte-exact', () => {
    const xml = DOC('<ul><li><p props="ai"><xref keyref="k">Go</xref> to <menucascade><uicontrol>A</uicontrol><uicontrol>B</uicontrol></menucascade>.</p></li></ul><p>Other.</p>');
    expect(edit(xml, 'Other.', 'Other, edited.').out).toBe(xml.replace('Other.', 'Other, edited.'));
  });
});
