// @vitest-environment jsdom
//
// BUG-26 — two adjacent same-type lists in the same body or container merge
// into one on parse. ADR-009's boundary node already stops this across a
// container boundary; this pins the same-container case, found in the real
// topic concept/external-support-options.dita (two adjacent <ul>s directly
// in <conbody>). Lexical's own ListNode.transform() merges any two sibling
// lists of the same listType ('bullet' or 'number') the moment they become
// siblings with nothing else between them — which includes <ol> next to
// <steps> and <ul> next to <steps-unordered>, since both pairs share a
// listType despite different DITA tags.
import { describe, it, expect } from 'vitest';
import { $getRoot, $createTextNode, $isElementNode, $isTextNode, type LexicalNode, type TextNode } from 'lexical';
import { $createListItemNode } from '@lexical/list';
import { createTestEditor, roundTrip } from '../helpers/createTestEditor';
import { parseXmlToLexical } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../../sync/nodeOriginMap';

const CONCEPT = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="c"><title>T</title><conbody>${body}</conbody></concept>`;
const TASK = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">\n<task id="t"><title>T</title><taskbody>${body}</taskbody></task>`;

function findText(node: LexicalNode, needle: string): TextNode | null {
  if ($isTextNode(node) && node.getTextContent() === needle) return node;
  if ($isElementNode(node)) for (const c of node.getChildren()) { const r = findText(c, needle); if (r) return r; }
  return null;
}

describe('BUG-26 — two adjacent same-type lists round-trip as two lists, unedited', () => {
  it('two adjacent <ul>s (the real-topic shape)', () => {
    const xml = CONCEPT('<ul><li>A</li></ul><ul><li>B</li></ul>');
    expect(roundTrip(xml)).toBe(xml);
  });

  it('two adjacent <ol>s', () => {
    const xml = CONCEPT('<ol><li>A</li></ol><ol><li>B</li></ol>');
    expect(roundTrip(xml)).toBe(xml);
  });

  it('three adjacent <ul>s', () => {
    const xml = CONCEPT('<ul><li>A</li></ul><ul><li>B</li></ul><ul><li>C</li></ul>');
    expect(roundTrip(xml)).toBe(xml);
  });

  it('<ol> then <steps> inside a task — different tags, the same Lexical list type ("number")', () => {
    const xml = TASK('<ol><li>A</li></ol><steps><step><cmd>B</cmd></step></steps>');
    expect(roundTrip(xml)).toBe(xml);
  });

  it('<steps-unordered> then <ul> — different tags, the same Lexical list type ("bullet")', () => {
    const xml = TASK('<steps-unordered><step><cmd>A</cmd></step></steps-unordered><ul><li>B</li></ul>');
    expect(roundTrip(xml)).toBe(xml);
  });

  it('a <ul> and an <ol> adjacent (different types) round-trip fine without needing a boundary', () => {
    const xml = CONCEPT('<ul><li>A</li></ul><ol><li>B</li></ol>');
    expect(roundTrip(xml)).toBe(xml);
  });

  it('two <ul>s separated by a <p> are unaffected (no boundary needed, none inserted)', () => {
    const xml = CONCEPT('<ul><li>A</li></ul><p>Text.</p><ul><li>B</li></ul>');
    expect(roundTrip(xml)).toBe(xml);
  });
});

describe('BUG-26 — the editor actually holds two separate list nodes, not one merged list', () => {
  it('parses to two top-level list nodes with the right item counts', () => {
    const xml = CONCEPT('<ul><li>A</li></ul><ul><li>B</li><li>C</li></ul>');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.getEditorState().read(() => {
      const lists = $getRoot().getChildren().filter(c => c.getType() === 'list');
      expect(lists).toHaveLength(2);
      expect((lists[0] as any).getChildrenSize()).toBe(1);
      expect((lists[1] as any).getChildrenSize()).toBe(2);
    });
  });
});

describe('BUG-26 — an edit to one list leaves the other, and the rest of the topic, untouched', () => {
  it('editing an item in the first list does not touch the second', () => {
    const xml = CONCEPT('<ul><li>A</li></ul><ul><li>B</li></ul>');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.update(() => { findText($getRoot(), 'A')!.setTextContent('A edited'); }, { discrete: true });
    const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
    expect(out).toBe(xml.replace('>A<', '>A edited<'));
  });

  it('editing an item in the second list does not touch the first', () => {
    const xml = CONCEPT('<ul><li>A</li></ul><ul><li>B</li></ul>');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.update(() => { findText($getRoot(), 'B')!.setTextContent('B edited'); }, { discrete: true });
    const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
    expect(out).toBe(xml.replace('>B<', '>B edited<'));
  });

  it('adding an item to the first list does not merge it into the second', () => {
    const xml = CONCEPT('<ul><li>A</li></ul><ul><li>B</li></ul>');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.update(() => {
      const lists = $getRoot().getChildren().filter((c: any) => c.getType() === 'list') as any[];
      const newLi = $createListItemNode();
      newLi.append($createTextNode('A2'));
      lists[0].append(newLi);
    }, { discrete: true });
    const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
    expect(out).toBe(xml.replace('<li>A</li>', '<li>A</li><li>A2</li>'));
  });
});
