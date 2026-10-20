// @vitest-environment jsdom
//
// P2-25 slice 1 / ADR-009 — DITA 1.3 troubleshooting topics.
//
// Byte-stability of the two fixtures is pinned in byte-stability.test.ts. This
// file covers the edit path: a change made in the visual editor must land in
// the right container, and untouched containers must stay byte-identical.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { $getRoot, $isTextNode } from 'lexical';
import { createTestEditor } from '../helpers/createTestEditor';
import { parseXmlToLexical } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../../sync/nodeOriginMap';
import { validateDitaXml, findUnrecognizedElements } from '../../lib/xml-utils';

const RICH = readFileSync(join(__dirname, 'fixtures', 'troubleshooting-rich.dita'), 'utf-8');

function setup(xml: string) {
  const editor = createTestEditor();
  const originMap = createNodeOriginMap();
  const cache = createXmlMetaCache();
  parseXmlToLexical(xml, editor, originMap, true);
  return { editor, originMap, cache, serialize: () => serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache) };
}

/** Replace the first text node whose content includes `needle`. */
function editText(editor: ReturnType<typeof createTestEditor>, needle: string, replacement: string) {
  let found = false;
  editor.update(() => {
    const walk = (node: any) => {
      if (found) return;
      if ($isTextNode(node) && node.getTextContent().includes(needle)) {
        node.setTextContent(node.getTextContent().replace(needle, replacement));
        found = true;
        return;
      }
      if (typeof node.getChildren === 'function') node.getChildren().forEach(walk);
    };
    $getRoot().getChildren().forEach(walk);
  }, { discrete: true });
  if (!found) throw new Error(`text "${needle}" not found in editor`);
}

/** The inner XML of the n-th (0-based) element with the given tag, raw string slice. */
function nthElement(xml: string, tag: string, n: number): string {
  const re = new RegExp(`<${tag}\\b[^>]*(?:/>|>[\\s\\S]*?</${tag}>)`, 'g');
  const matches = xml.match(re) ?? [];
  if (!matches[n]) throw new Error(`no ${tag}[${n}] in output`);
  return matches[n];
}

describe('troubleshooting topics — parse', () => {
  it('renders the troublebody instead of leaving the editor empty (the P2-25 data-loss bug)', () => {
    const { editor } = setup(RICH);
    const text = editor.getEditorState().read(() => $getRoot().getTextContent());
    expect(text).toContain('Symptoms');
    expect(text).toContain('The device has no power.');
    expect(text).toContain('Reseat the harness connector.');
    expect(text).toContain('Move the vehicle to an area with coverage');
    expect(text).toContain('Contact support with the device serial number.');
  });

  it('opens each condition/cause/remedy with a boundary marker and never merges adjacent lists', () => {
    const { editor } = setup(RICH);
    const kinds = editor.getEditorState().read(() =>
      $getRoot().getChildren().filter((n: any) => n.getType() === 'dita-container-boundary').map((n: any) => n.getKind()),
    );
    // condition, then (cause, remedy) × 3 solutions — the third cause is empty but still gets a marker
    expect(kinds).toEqual(['condition', 'cause', 'remedy', 'cause', 'remedy', 'cause', 'remedy']);
    // The steps-informal <ol> and the third remedy's <steps> are both ordered
    // lists; without the boundary Lexical merges them (ListNode.transform).
    const lists = editor.getEditorState().read(() =>
      $getRoot().getChildren().filter((n: any) => n.getType() === 'list').map((n: any) => n.getTextContent().split('\n\n')),
    );
    expect(lists.some(items => items.includes('Contact support with the device serial number.') && items.length === 1)).toBe(true);
  });

  it('stamps every node inside a container with its containerPath', () => {
    const { editor, originMap } = setup(RICH);
    const paths = editor.getEditorState().read(() =>
      $getRoot().getChildren().map(n => originMap.get(n.getKey())?.containerPath ?? null),
    );
    // title, shortdesc → no path; then condition h2 + p; then solution 0 cause/remedy …
    expect(paths.slice(0, 2)).toEqual([null, null]);
    expect(paths).toContain('condition#0');
    expect(paths).toContain('troubleSolution#0/cause#0');
    expect(paths).toContain('troubleSolution#0/remedy#0');
    expect(paths).toContain('troubleSolution#1/remedy#0/steps-informal#0');
    expect(paths).toContain('troubleSolution#2/remedy#0');
    // Ordinals are per-parent: the third solution's remedy is remedy#0 of solution#2, not remedy#2.
    expect(paths.some(p => p?.includes('remedy#2'))).toBe(false);
  });

  it('a container title parses as an h2, like a section title', () => {
    const { editor } = setup(RICH);
    const h2s = editor.getEditorState().read(() =>
      $getRoot().getChildren().filter((n: any) => n.getType() === 'heading' && n.getTag() === 'h2').map(n => n.getTextContent()),
    );
    expect(h2s).toEqual(['Symptoms', 'Restore power']);
  });

  it('validateDitaXml accepts a troubleshooting root and the import check flags no troubleshooting element', () => {
    expect(validateDitaXml(RICH).valid).toBe(true);
    const unrecognized = findUnrecognizedElements(RICH);
    for (const tag of ['troubleshooting', 'troublebody', 'troubleSolution', 'condition', 'cause', 'remedy', 'steps-unordered', 'steps-informal', 'keyword']) {
      expect(unrecognized).not.toContain(tag);
    }
  });
});

// BUG-25 — a <p> that wraps a block (Heretto authors <p>text<ul>…</ul></p> freely,
// not only in troubleshooting topics). Before this fix the unedited round-trip
// rewrote it as <p>text</p><ul/> and dropped the wrapper's attributes.
describe('BUG-25: <p> wrapping a block is patched in place', () => {
  const CONCEPT = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="pwrap" class="- topic/topic concept/concept "><title class="- topic/title ">Wrapped list</title><conbody class="- topic/body  concept/conbody "><p class="- topic/p ">Intro text.<ul class="- topic/ul "><li class="- topic/li "><p class="- topic/p ">One</p></li><li class="- topic/li "><p class="- topic/p ">Two</p></li></ul>Trailing text.</p><p class="- topic/p ">Next paragraph.</p></conbody></concept>`;

  it('unedited round-trip is byte-stable', () => {
    const { serialize } = setup(CONCEPT);
    expect(serialize()).toBe(CONCEPT);
  });

  it('editing the leading text keeps the wrapper, its class attributes, and the list', () => {
    const { editor, serialize } = setup(CONCEPT);
    editText(editor, 'Intro text.', 'Intro sentence.');
    const out = serialize();
    // (nthElement cannot be used for <p> here: the wrapper contains nested <p>s.)
    expect(out).toContain(
      '<p class="- topic/p ">Intro sentence.<ul class="- topic/ul "><li class="- topic/li "><p class="- topic/p ">One</p></li><li class="- topic/li "><p class="- topic/p ">Two</p></li></ul>Trailing text.</p><p class="- topic/p ">Next paragraph.</p>',
    );
  });

  it('editing the trailing text after the list rewrites only that segment', () => {
    const { editor, serialize } = setup(CONCEPT);
    editText(editor, 'Trailing text.', 'Closing text.');
    const out = serialize();
    expect(out).toContain('</ul>Closing text.</p><p class="- topic/p ">Next paragraph.</p>');
    expect(out).toContain('<p class="- topic/p ">Intro text.<ul class="- topic/ul ">');
  });

  it('editing a list item inside the wrapped list patches that <li>', () => {
    const { editor, serialize } = setup(CONCEPT);
    editText(editor, 'Two', 'Two (edited)');
    const out = serialize();
    expect(out).toContain('<li class="- topic/li "><p class="- topic/p ">Two (edited)</p></li></ul>Trailing text.</p>');
  });
});

describe('troubleshooting topics — edits land in the right container', () => {
  it('editing a cause paragraph changes that <cause> only; siblings stay byte-identical', () => {
    const { editor, serialize } = setup(RICH);
    editText(editor, 'The device is out of cellular coverage.', 'The device is outside cellular coverage.');
    const out = serialize();

    // Second solution's cause carries the edit…
    expect(nthElement(out, 'cause', 1)).toContain('The device is outside cellular coverage.');
    // …the first solution is untouched byte-for-byte…
    expect(nthElement(out, 'troubleSolution', 0)).toBe(nthElement(RICH, 'troubleSolution', 0));
    // …and the empty trailing <cause/> survives.
    expect(nthElement(out, 'cause', 2)).toBe('<cause class="- topic/section troubleshooting/cause "/>');
  });

  it('editing a container title patches <condition><title>', () => {
    const { editor, serialize } = setup(RICH);
    editText(editor, 'Symptoms', 'What you see');
    const out = serialize();
    expect(nthElement(out, 'condition', 0)).toContain('<title class="- topic/title ">What you see</title>');
    expect(nthElement(out, 'condition', 0)).toContain('<keyword class="- topic/keyword ">heartbeat</keyword>');
  });

  it('editing a step inside <steps-unordered> patches its <cmd> and keeps the <info>', () => {
    const { editor, serialize } = setup(RICH);
    editText(editor, 'Reseat the harness connector.', 'Reseat the harness connector firmly.');
    const out = serialize();
    const remedy = nthElement(out, 'remedy', 0);
    expect(remedy).toContain('<cmd class="- topic/ph task/cmd ">Reseat the harness connector firmly.</cmd>');
    expect(remedy).toContain('<info class="- topic/itemgroup task/info "><p class="- topic/p ">Use a fuse of the same rating.</p></info>');
    expect(remedy).toContain('<steps-unordered ');
  });

  it('editing inside <steps-informal> patches the paragraph and keeps the <ol>', () => {
    const { editor, serialize } = setup(RICH);
    editText(editor, 'wait for the next scheduled upload.', 'wait for the next upload.');
    const out = serialize();
    const informal = nthElement(out, 'steps-informal', 0);
    expect(informal).toContain('wait for the next upload.');
    expect(informal).toContain('<ol class="- topic/ol ">');
    expect(informal).toContain('Refresh the device page.');
  });

  it('editing a step in the third remedy lands in that <steps>, not in the previous <ol>', () => {
    const { editor, serialize } = setup(RICH);
    editText(editor, 'Contact support with the device serial number.', 'Contact support with the serial number.');
    const out = serialize();
    expect(nthElement(out, 'steps', 0)).toContain('Contact support with the serial number.');
    expect(nthElement(out, 'steps-informal', 0)).toBe(nthElement(RICH, 'steps-informal', 0));
  });

  it('the serialized document keeps the troubleshooting doctype and root', () => {
    const { editor, serialize } = setup(RICH);
    editText(editor, 'Symptoms', 'Symptom');
    const out = serialize();
    expect(out).toContain('<!DOCTYPE troubleshooting PUBLIC "-//OASIS//DTD DITA Troubleshooting//EN" "troubleshooting.dtd">');
    expect(out).toMatch(/^<\?xml[^>]*>\s*<!DOCTYPE troubleshooting/);
    expect(out).toContain('<troublebody ');
  });
});
