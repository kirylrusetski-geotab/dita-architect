// @vitest-environment jsdom
//
// BUG-37 — a <b>, <i>, or <codeph> that holds exactly one text child is
// spliced into (like ordinary text, via the BUG-34/36 reconciler machinery)
// instead of being treated as one atomic, unsplittable element. Before this
// fix: appending text created a second sibling element
// (<codeph>sync</codeph><codeph> ZQX</codeph>), and editing text inside one
// replaced the whole element via serializeTextRun, dropping its attributes.
// Invariants written before the fix, mirroring the edit fuzz's exact
// mechanism (appending a word to an existing text node via setTextContent).
import { describe, it, expect } from 'vitest';
import { $getRoot, $createTextNode, $isElementNode, $isTextNode, type LexicalNode, type TextNode } from 'lexical';
import { createTestEditor } from '../helpers/createTestEditor';
import { parseXmlToLexical } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../../sync/nodeOriginMap';
import { checkSerializedStructure } from '../../sync/structure-check';

const DOC = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="c"><title>T</title><conbody>${body}</conbody></concept>`;

function findText(node: LexicalNode, needle: string): TextNode | null {
  if ($isTextNode(node) && node.getTextContent() === needle) return node;
  if ($isElementNode(node)) for (const c of node.getChildren()) { const r = findText(c, needle); if (r) return r; }
  return null;
}

/** Parse, replace the text node whose content is exactly `oldText` with `newText`, serialize. */
function replaceText(xml: string, oldText: string, newText: string) {
  const editor = createTestEditor();
  const originMap = createNodeOriginMap();
  parseXmlToLexical(xml, editor, originMap, true);
  editor.update(() => {
    const t = findText($getRoot(), oldText);
    if (!t) throw new Error(`no text node is exactly "${oldText}"`);
    t.setTextContent(newText);
  }, { discrete: true });
  const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
  return { out, mismatches: checkSerializedStructure(editor.getEditorState(), out, originMap) };
}

/** Clear the top-level block whose text is exactly `oldText` and replace its
 *  content with a single new plain text node — simulates the author
 *  deliberately removing all formatting (not editing text that stays
 *  formatted). */
function clearToPlainText(xml: string, oldText: string, newText: string) {
  const editor = createTestEditor();
  const originMap = createNodeOriginMap();
  parseXmlToLexical(xml, editor, originMap, true);
  editor.update(() => {
    const p = $getRoot().getChildren().find(c => c.getTextContent() === oldText);
    if (!p || !$isElementNode(p)) throw new Error(`no block is exactly "${oldText}"`);
    p.clear();
    p.append($createTextNode(newText));
  }, { discrete: true });
  const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
  return { out, mismatches: checkSerializedStructure(editor.getEditorState(), out, originMap) };
}

describe('BUG-37 — appending to the end keeps one element, with its attributes', () => {
  it('<codeph class="…">: appending a word (the exact edit-fuzz mechanism)', () => {
    const xml = DOC('<p>Run <codeph class="+ topic/ph pr-d/codeph ">sync</codeph> now.</p>');
    const { out, mismatches } = replaceText(xml, 'sync', 'sync ZQX');
    expect(out).toBe(xml.replace('>sync<', '>sync ZQX<'));
    expect(mismatches).toEqual([]);
  });

  it('<b outputclass="…">: appending a word', () => {
    const xml = DOC('<p>Click <b outputclass="x">Save</b> now.</p>');
    const { out } = replaceText(xml, 'Save', 'Save now');
    expect(out).toBe(xml.replace('>Save<', '>Save now<'));
  });

  it('<i class="…">: appending a word', () => {
    const xml = DOC('<p>See <i class="x">note</i> below.</p>');
    const { out } = replaceText(xml, 'note', 'note here');
    expect(out).toBe(xml.replace('>note<', '>note here<'));
  });

  it('a <codeph> with no attributes at all', () => {
    const xml = DOC('<p>Run <codeph>sync</codeph> now.</p>');
    const { out } = replaceText(xml, 'sync', 'sync ZQX');
    expect(out).toBe(xml.replace('>sync<', '>sync ZQX<'));
  });
});

describe('BUG-37 — prepending to the start keeps one element, with its attributes', () => {
  it('<b class="…">: text typed right before it', () => {
    const xml = DOC('<p>Click <b class="x">Save</b> now.</p>');
    const { out } = replaceText(xml, 'Save', 'Please Save');
    expect(out).toBe(xml.replace('>Save<', '>Please Save<'));
  });

  it('<codeph>: text typed right before it', () => {
    const xml = DOC('<p>Run <codeph class="x">npm test</codeph> first.</p>');
    const { out } = replaceText(xml, 'npm test', 'always npm test');
    expect(out).toBe(xml.replace('>npm test<', '>always npm test<'));
  });
});

describe('BUG-37 — an edit inside one keeps the element and its attributes (no full-element rewrite)', () => {
  it('<codeph class="…">: a character replaced in the middle', () => {
    const xml = DOC('<p>Run <codeph class="x">sync</codeph> now.</p>');
    const { out, mismatches } = replaceText(xml, 'sync', 'sinc');
    expect(out).toBe(xml.replace('>sync<', '>sinc<'));
    expect(mismatches).toEqual([]);
  });

  it('<b class="…">: a word replaced in the middle, attributes kept', () => {
    const xml = DOC('<p>Click <b class="x">Save</b> now.</p>');
    const { out } = replaceText(xml, 'Save', 'Store');
    expect(out).toBe(xml.replace('>Save<', '>Store<'));
  });

  it('a partial edit with unchanged prefix AND suffix inside one <codeph>', () => {
    const xml = DOC('<p>Run <codeph class="x">synchronize</codeph> now.</p>');
    const { out } = replaceText(xml, 'synchronize', 'syncXXXronize');
    expect(out).toBe(xml.replace('>synchronize<', '>syncXXXronize<'));
  });
});

describe('BUG-37 — removing the formatting entirely still replaces the whole element', () => {
  it('a <b> word cleared to plain text has its tag removed (unchanged behaviour)', () => {
    const xml = DOC('<p>Some <b>emphasis</b> here.</p>');
    const { out, mismatches } = clearToPlainText(xml, 'Some emphasis here.', 'Some emphasis here.');
    expect(out).toBe(xml.replace('<b>emphasis</b>', 'emphasis'));
    expect(mismatches).toEqual([]);
  });

  it('a <codeph> word cleared to plain text has its tag (and attribute) removed', () => {
    const xml = DOC('<p>Run <codeph class="x">sync</codeph> now.</p>');
    const { out } = clearToPlainText(xml, 'Run sync now.', 'Run sync now.');
    expect(out).toBe(xml.replace('<codeph class="x">sync</codeph>', 'sync'));
  });
});

describe('BUG-37 — unrelated siblings and the rest of the paragraph are untouched', () => {
  it('editing one <codeph> leaves a second, unrelated <codeph> in the same paragraph byte-identical', () => {
    const xml = DOC('<p>Run <codeph class="a">build</codeph> then <codeph class="b">test</codeph>.</p>');
    const { out, mismatches } = replaceText(xml, 'build', 'rebuild');
    expect(out).toBe(xml.replace('>build<', '>rebuild<'));
    expect(mismatches).toEqual([]);
  });

  it('editing text before a <b> leaves the <b> and its attributes byte-identical', () => {
    const xml = DOC('<p>Please click <b class="x">Save</b> now.</p>');
    const { out } = replaceText(xml, 'Please click ', 'Now click ');
    expect(out).toBe(xml.replace('Please click ', 'Now click '));
  });
});
