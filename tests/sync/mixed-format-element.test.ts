// @vitest-environment jsdom
//
// BUG-44 — a <b>, <i>, or <codeph> with element children (mixed content). The
// parser took such an element's textContent as one formatted TextNode, so the
// nested element vanished from the editor: <b>bold with <i>italic inside</i>
// it</b> showed as one bold run, and <b><ph conkeyref="…"/></b> (a real topic,
// sampled/concept/external-aux-rear-cam.dita) showed nothing at all — the
// variable chip was invisible. An edit then rebuilt the element from that
// flattened text (BUG-37's symptom). The fix scans the element's children like
// a container inline, each child carrying the element's own format.
// Invariants written before the fix.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { $getRoot, $createTextNode, $createParagraphNode, $isElementNode, $isTextNode, type LexicalNode, type TextNode } from 'lexical';
import { createTestEditor } from '../helpers/createTestEditor';
import { parseXmlToLexical } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../../sync/nodeOriginMap';
import { checkSerializedStructure } from '../../sync/structure-check';
import { setReconcileObserver, type ReconcileReport } from '../../sync/inline-reconcile';

const DOC = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="c"><title>T</title><conbody>${body}</conbody></concept>`;

interface Leaf { type: string; text: string; bold?: boolean; italic?: boolean; code?: boolean; ref?: string; inlineTag?: string }

function findText(node: LexicalNode, needle: string): TextNode | null {
  if ($isTextNode(node) && node.getTextContent() === needle) return node;
  if ($isElementNode(node)) for (const c of node.getChildren()) { const r = findText(c, needle); if (r) return r; }
  return null;
}

/** Every leaf of the first body paragraph, with the formats it shows. */
function leaves(xml: string): Leaf[] {
  const editor = createTestEditor();
  const originMap = createNodeOriginMap();
  parseXmlToLexical(xml, editor, originMap, true);
  return editor.getEditorState().read(() => {
    const out: Leaf[] = [];
    const visit = (n: LexicalNode) => {
      if ($isTextNode(n)) {
        const inlineTag = originMap.get(n.getKey())?.inlineTag;
        out.push({
          type: 'text', text: n.getTextContent(),
          ...(n.hasFormat('bold') ? { bold: true } : null),
          ...(n.hasFormat('italic') ? { italic: true } : null),
          ...(n.hasFormat('code') ? { code: true } : null),
          ...(inlineTag ? { inlineTag } : null),
        });
      } else if (n.getType() === 'ditaphref') {
        out.push({ type: 'chip', text: n.getTextContent(), ref: (n as unknown as { getRefValue(): string }).getRefValue() });
      } else if ($isElementNode(n)) {
        if (n.getType() === 'link') out.push({ type: 'link', text: '' });
        n.getChildren().forEach(visit);
      }
    };
    // The title is a heading; the first paragraph after it is the body's first <p>.
    const p = $getRoot().getChildren().find(c => c.getType() === 'paragraph');
    if (p) visit(p);
    return out;
  });
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
  const reports: ReconcileReport[] = [];
  setReconcileObserver(r => reports.push(r));
  try {
    const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
    return { out, reports, mismatches: checkSerializedStructure(editor.getEditorState(), out, originMap) };
  } finally {
    setReconcileObserver(null);
  }
}

/** Parse, toggle one format flag on the text node whose content is exactly `text`, serialize. */
function toggleFormat(xml: string, text: string, format: 'bold' | 'italic') {
  const editor = createTestEditor();
  const originMap = createNodeOriginMap();
  parseXmlToLexical(xml, editor, originMap, true);
  editor.update(() => {
    const t = findText($getRoot(), text);
    if (!t) throw new Error(`no text node is exactly "${text}"`);
    t.toggleFormat(format);
  }, { discrete: true });
  return serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
}

/** Parse and serialize with no edit; also report whether the reconciler patched anything. */
function unedited(xml: string) {
  const editor = createTestEditor();
  const originMap = createNodeOriginMap();
  parseXmlToLexical(xml, editor, originMap, true);
  const reports: ReconcileReport[] = [];
  setReconcileObserver(r => reports.push(r));
  try {
    const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
    return { out, reports, mismatches: checkSerializedStructure(editor.getEditorState(), out, originMap) };
  } finally {
    setReconcileObserver(null);
  }
}

const NESTED = DOC('<p>Nested: <b>bold with <i>italic inside</i> it</b> done.</p>');
const CHIP = DOC('<p>See <b class="x"><ph conkeyref="vars/sku"/></b> here.</p>');

describe('BUG-44 — the editor shows what a mixed-content <b>/<i>/<codeph> holds', () => {
  it('<b> with a nested <i>: three runs, the inner one bold AND italic', () => {
    expect(leaves(NESTED)).toEqual([
      { type: 'text', text: 'Nested: ' },
      { type: 'text', text: 'bold with ', bold: true },
      { type: 'text', text: 'italic inside', bold: true, italic: true },
      { type: 'text', text: ' it', bold: true },
      { type: 'text', text: ' done.' },
    ]);
  });

  it('<b> around a conkeyref <ph>: the variable chip is visible', () => {
    const got = leaves(CHIP);
    expect(got.filter(l => l.type === 'chip').map(l => l.ref)).toEqual(['vars/sku']);
  });

  it('the real topic: both <b>-wrapped SKU chips are visible', () => {
    const xml = readFileSync(join(__dirname, 'fixtures/sampled/concept/external-aux-rear-cam.dita'), 'utf-8');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(xml, editor, originMap, true);
    const refs = editor.getEditorState().read(() => {
      const found: string[] = [];
      const visit = (n: LexicalNode) => {
        if (n.getType() === 'ditaphref') found.push((n as unknown as { getRefValue(): string }).getRefValue());
        if ($isElementNode(n)) n.getChildren().forEach(visit);
      };
      $getRoot().getChildren().forEach(visit);
      return found;
    });
    // Line 9 and line 10 of the fixture open with a <b>-wrapped SKU chip.
    expect(refs).toContain('varsCamProdSKU/sku-ext-rear-cam-m8');
    expect(refs.filter(r => r === 'varsCamProdSKU/sku-ext-rear-cam-mini-usb').length).toBe(3);
  });

  it('<i> around a <uicontrol>: the stamped token shows bold (its own) and italic (the wrapper)', () => {
    expect(leaves(DOC('<p>Pick <i><uicontrol>Save</uicontrol></i> now.</p>'))).toEqual([
      { type: 'text', text: 'Pick ' },
      { type: 'text', text: 'Save', bold: true, italic: true, inlineTag: 'uicontrol' },
      { type: 'text', text: ' now.' },
    ]);
  });

  it('<b> around an <xref>: the link text is bold', () => {
    expect(leaves(DOC('<p>Read <b><xref href="a.dita">the guide</xref></b> first.</p>'))).toEqual([
      { type: 'text', text: 'Read ' },
      { type: 'link', text: '' },
      { type: 'text', text: 'the guide', bold: true },
      { type: 'text', text: ' first.' },
    ]);
  });

  it('<codeph> with a nested <b>: every run is code, the inner one also bold', () => {
    expect(leaves(DOC('<p>Run <codeph>npm <b>run</b> test</codeph> now.</p>'))).toEqual([
      { type: 'text', text: 'Run ' },
      { type: 'text', text: 'npm ', code: true },
      { type: 'text', text: 'run', bold: true, code: true },
      { type: 'text', text: ' test', code: true },
      { type: 'text', text: ' now.' },
    ]);
  });

  it('a run trimmed at the paragraph edge keeps its format', () => {
    expect(leaves(DOC('<p><b>bold <i>end </i></b></p>'))).toEqual([
      { type: 'text', text: 'bold ', bold: true },
      { type: 'text', text: 'end', bold: true, italic: true },
    ]);
  });

  it('a plain <b> trimmed at the paragraph end keeps its bold (the old trim dropped it)', () => {
    expect(leaves(DOC('<p>Click <b>Save </b></p>'))).toEqual([
      { type: 'text', text: 'Click ' },
      { type: 'text', text: 'Save', bold: true },
    ]);
  });

  it('a plain <b> trimmed at the paragraph start: an edit lands at the right offset', () => {
    const xml = DOC('<p><b> Save</b> it.</p>');
    expect(leaves(xml)).toEqual([
      { type: 'text', text: 'Save', bold: true },
      { type: 'text', text: ' it.' },
    ]);
    const { out } = replaceText(xml, 'Save', 'Save all');
    expect(out).toBe(xml.replace('<b> Save</b>', '<b> Save all</b>'));
  });
});

describe('BUG-44 — unedited: byte-stable, no reconciler patch, no structure warning', () => {
  const cases: Array<[string, string]> = [
    ['nested <i> in <b>', NESTED],
    ['conkeyref <ph> in <b class>', CHIP],
    ['<uicontrol> in <i>', DOC('<p>Pick <i><uicontrol>Save</uicontrol></i> now.</p>')],
    ['<xref> in <b>', DOC('<p>Read <b><xref href="a.dita">the guide</xref></b> first.</p>')],
    ['<b> in <codeph>', DOC('<p>Run <codeph>npm <b>run</b> test</codeph> now.</p>')],
    ['edge-trimmed nested run', DOC('<p><b>bold <i>end </i></b></p>')],
  ];
  for (const [name, xml] of cases) {
    it(name, () => {
      const { out, reports, mismatches } = unedited(xml);
      expect(out).toBe(xml);
      expect(reports.filter(r => r.status !== 'untouched')).toEqual([]);
      expect(mismatches).toEqual([]);
    });
  }
});

describe('BUG-44 — an edit inside the element changes only that text, keeping every element', () => {
  it('appending to the nested <i> (the edit-fuzz mechanism)', () => {
    const { out, mismatches } = replaceText(NESTED, 'italic inside', 'italic inside ZQX');
    expect(out).toBe(NESTED.replace('italic inside', 'italic inside ZQX'));
    expect(mismatches).toEqual([]);
  });

  it('editing the <b> text before the nested <i>', () => {
    const { out } = replaceText(NESTED, 'bold with ', 'bold and ');
    expect(out).toBe(NESTED.replace('bold with ', 'bold and '));
  });

  it('appending to the <b> text after the nested <i>', () => {
    const { out } = replaceText(NESTED, ' it', ' it again');
    expect(out).toBe(NESTED.replace('</i> it</b>', '</i> it again</b>'));
  });

  it('editing text outside the <b> leaves it byte-identical', () => {
    const { out } = replaceText(NESTED, ' done.', ' finished.');
    expect(out).toBe(NESTED.replace(' done.', ' finished.'));
  });

  it('editing text beside a <b>-wrapped chip keeps the <b>, its class, and the chip', () => {
    const before = replaceText(CHIP, 'See ', 'Look at ');
    expect(before.out).toBe(CHIP.replace('See ', 'Look at '));
    const after = replaceText(CHIP, ' here.', ' there.');
    expect(after.out).toBe(CHIP.replace(' here.', ' there.'));
    expect(after.mismatches).toEqual([]);
  });

  it('editing the link text inside a <b>: the <xref> is reconciled in place, no <b> added inside it', () => {
    const xml = DOC('<p>Read <b><xref href="a.dita">the guide</xref></b> first.</p>');
    const { out } = replaceText(xml, 'the guide', 'the full guide');
    expect(out).toBe(xml.replace('the guide', 'the full guide'));
  });

  it('editing the nested <b> inside a <codeph>', () => {
    const xml = DOC('<p>Run <codeph>npm <b>run</b> test</codeph> now.</p>');
    const { out, mismatches } = replaceText(xml, 'run', 'rerun');
    expect(out).toBe(xml.replace('<b>run</b>', '<b>rerun</b>'));
    expect(mismatches).toEqual([]);
  });

  it('appending to an edge-trimmed nested run lands before the trimmed space', () => {
    const xml = DOC('<p><b>bold <i>end </i></b></p>');
    const { out } = replaceText(xml, 'end', 'end more');
    expect(out).toBe(xml.replace('<i>end </i>', '<i>end more </i>'));
  });

  it('the inline-elements fixture: appending to the nested <i>', () => {
    const xml = readFileSync(join(__dirname, 'fixtures/inline-elements.dita'), 'utf-8');
    const { out } = replaceText(xml, 'italic inside', 'italic inside ZQX');
    expect(out).toBe(xml.replace('italic inside', 'italic inside ZQX'));
  });
});

describe('BUG-44 — format changes inside the element', () => {
  it('removing italic from the nested run unwraps only the <i>', () => {
    const out = toggleFormat(NESTED, 'italic inside', 'italic');
    expect(out).toBe(NESTED.replace('<i>italic inside</i>', 'italic inside'));
  });

  it('clearing the whole paragraph to plain text removes both elements', () => {
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(NESTED, editor, originMap, true);
    editor.update(() => {
      const p = $getRoot().getChildren().find(c => c.getType() === 'paragraph');
      if (!p || !$isElementNode(p)) throw new Error('no paragraph');
      const text = p.getTextContent();
      p.clear();
      p.append($createTextNode(text));
    }, { discrete: true });
    const out = serializeLexicalToXml(editor.getEditorState(), NESTED, originMap, createXmlMetaCache());
    expect(out).toBe(NESTED.replace('<b>bold with <i>italic inside</i> it</b>', 'bold with italic inside it'));
  });
});

describe('BUG-44 — new text that is both code and bold/italic keeps every format', () => {
  it('a new paragraph with bold code text serializes as <b><codeph>', () => {
    const xml = DOC('<p>One.</p>');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.update(() => {
      const p = $getRoot().getChildren().find(c => c.getType() === 'paragraph');
      if (!p) throw new Error('no paragraph');
      const t = $createTextNode('npm test');
      t.toggleFormat('code');
      t.toggleFormat('bold');
      p.insertAfter($createParagraphNode().append(t));
    }, { discrete: true });
    const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
    expect(out).toContain('<p><b><codeph>npm test</codeph></b></p>');
  });
});
