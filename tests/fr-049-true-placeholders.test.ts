// @vitest-environment jsdom
//
// FR-049 — true placeholders. The template title/shortdesc are genuinely empty
// nodes; the prompt is CSS decoration applied by ShortdescPlugin while the node
// is empty. These tests pin the data side: templates carry no prose, parse to
// empty nodes, round-trip byte-stable, and typing produces real content.
import { describe, it, expect } from 'vitest';
import { $getRoot, $createTextNode } from 'lexical';
import { DITA_TEMPLATES, DITA_TOPIC_TYPE, DITA_PLACEHOLDER_TITLES, DITA_PLACEHOLDER_SHORTDESCS, INITIAL_DITA } from '../constants/dita';
import { createTestEditor, roundTrip } from './helpers/createTestEditor';
import { parseXmlToLexical } from '../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../sync/nodeOriginMap';
import { convertDitaTopic } from '../lib/xml-utils';

describe('FR-049: templates carry no placeholder prose', () => {
  for (const type of DITA_TOPIC_TYPE) {
    it(`${type} template has an empty <title/> and <shortdesc/>`, () => {
      const xml = DITA_TEMPLATES[type];
      expect(xml).toContain('<title/>');
      expect(xml).toContain('<shortdesc/>');
      expect(xml).not.toContain(DITA_PLACEHOLDER_TITLES[type]);
      expect(xml).not.toContain(DITA_PLACEHOLDER_SHORTDESCS[type]);
    });

    it(`${type} template parses to an empty h1 and an empty shortdesc paragraph`, () => {
      const editor = createTestEditor();
      const originMap = createNodeOriginMap();
      parseXmlToLexical(DITA_TEMPLATES[type], editor, originMap, true);
      editor.getEditorState().read(() => {
        const [first, second] = $getRoot().getChildren() as any[];
        expect(first.getType()).toBe('heading');
        expect(first.getTag()).toBe('h1');
        expect(first.getTextContent()).toBe('');
        expect(second.getType()).toBe('paragraph');
        expect(originMap.get(second.getKey())?.tag).toBe('shortdesc');
        expect(second.getTextContent()).toBe('');
      });
    });

    it(`${type} template round-trips byte-stable (empty nodes survive)`, () => {
      const xml = DITA_TEMPLATES[type];
      expect(roundTrip(xml).replace(/\s+$/, '')).toBe(xml.replace(/\s+$/, ''));
    });
  }

  it('typing into the empty title produces a real <title> with only the typed text', () => {
    const xml = DITA_TEMPLATES.task;
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.update(() => {
      const [title, shortdesc] = $getRoot().getChildren() as any[];
      title.append($createTextNode('Installing the widget'));
      shortdesc.append($createTextNode('How to install it.'));
    }, { discrete: true });
    const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
    expect(out).toContain('<title>Installing the widget</title>');
    expect(out).toContain('<shortdesc>How to install it.</shortdesc>');
    expect(out).not.toContain('Enter your');
  });

  it('converting a fresh template to another topic type keeps title/shortdesc empty (no prose to swap)', () => {
    const result = convertDitaTopic(DITA_TEMPLATES.task, 'concept');
    expect(result.ok).toBe(true);
    const converted = result.ok ? result.xml : '';
    expect(converted).toContain('<title/>');
    expect(converted).toContain('<shortdesc/>');
    expect(converted).not.toContain('Enter your');
  });

  it('the demo topic (INITIAL_DITA) has real prose, not placeholders', () => {
    expect(INITIAL_DITA).toContain('<title>Setting up the widget</title>');
    expect(INITIAL_DITA).not.toContain('Enter your');
    expect(INITIAL_DITA).not.toContain('<title/>');
  });

  it('the parser no longer special-cases template prose: it is ordinary text', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="legacy"><title>Enter your task title</title><shortdesc>Enter a short description of the task.</shortdesc><taskbody><steps><step><cmd>x</cmd></step></steps></taskbody></task>`;
    // A legacy topic that still contains the old prose round-trips verbatim —
    // the text is content now, and the author sees it as content (no muted style).
    expect(roundTrip(xml).replace(/\s+$/, '')).toBe(xml.replace(/\s+$/, ''));
  });
});
