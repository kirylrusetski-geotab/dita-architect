// @vitest-environment jsdom
//
// BUG-46 (ADR-013 decision 6) — a variable reference on anything but <ph>/<term>
// was invisible in the visual editor. The scanner made a chip only of a
// ref-carrying <ph>/<term>; <keyword conkeyref="varsProductnames/…"/> (37 in the
// corpus), <uicontrol conkeyref/>, <wintitle conkeyref/> fell to the stamped-text
// path with their empty text content, so the writer saw "Use  daily." and no
// variable at all. The fix chips any ref-carrying inline element that holds no
// text of its own; the chip remembers its element (`refTag`) so a chip the author
// creates (Insert Variable, FR-066) serializes as that element, not as <ph>.
// Invariants written before the fix.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { $getRoot, $isElementNode, $isTextNode, type LexicalNode, type TextNode } from 'lexical';
import { createTestEditor, roundTrip } from '../helpers/createTestEditor';
import { parseXmlToLexical } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../../sync/nodeOriginMap';
import { DitaPhRefNode, $createDitaPhRefNode, $isDitaPhRefNode } from '../../components/DitaPhRefNode';

const DOC = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="c"><title>T</title><conbody>${body}</conbody></concept>`;

interface ChipInfo { refTag: string; refType: string; refValue: string; text: string }

function parse(xml: string) {
  const editor = createTestEditor();
  const originMap = createNodeOriginMap();
  parseXmlToLexical(xml, editor, originMap, true);
  return { editor, originMap };
}

function chipsIn(xml: string): ChipInfo[] {
  const { editor } = parse(xml);
  return editor.getEditorState().read(() => {
    const out: ChipInfo[] = [];
    const visit = (n: LexicalNode) => {
      if ($isDitaPhRefNode(n)) {
        out.push({ refTag: n.getRefTag(), refType: n.getRefType(), refValue: n.getRefValue(), text: n.getTextContent() });
      } else if ($isElementNode(n)) n.getChildren().forEach(visit);
    };
    $getRoot().getChildren().forEach(visit);
    return out;
  });
}

function findText(node: LexicalNode, needle: string): TextNode | null {
  if ($isTextNode(node) && node.getTextContent() === needle) return node;
  if ($isElementNode(node)) for (const c of node.getChildren()) { const r = findText(c, needle); if (r) return r; }
  return null;
}

/** Parse, run `edit` in an update, serialize against the source. */
function editAndSerialize(xml: string, edit: () => void): string {
  const { editor, originMap } = parse(xml);
  editor.update(edit, { discrete: true });
  return serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
}

const REF_ATTRS = ['conkeyref', 'keyref', 'conref'] as const;
const TAGS = ['keyword', 'uicontrol', 'wintitle', 'codeph', 'b', 'cite', 'menucascade'] as const;

describe('BUG-46: every ref-carrying inline element with no text is a chip', () => {
  for (const tag of TAGS) {
    for (const attr of REF_ATTRS) {
      const value = attr === 'conref' ? 'warehouse.dita#t/v1' : attr === 'keyref' ? 'someKey' : 'varsX/v1';
      const xml = DOC(`<p>Use <${tag} ${attr}="${value}"/> daily.</p>`);

      it(`<${tag} ${attr}/> parses to a chip that knows its element`, () => {
        expect(chipsIn(xml)).toEqual([{ refTag: tag, refType: attr, refValue: value, text: '' }]);
      });

      it(`<${tag} ${attr}/> round-trips byte-identical unedited`, () => {
        expect(roundTrip(xml)).toBe(xml);
      });

      it(`<${tag} ${attr}/> stays byte-identical after an edit elsewhere in its paragraph`, () => {
        const out = editAndSerialize(xml, () => {
          const t = findText($getRoot(), ' daily.');
          if (!t) throw new Error('no " daily." text node');
          t.setTextContent(' daily. EDITED');
        });
        expect(out).toBe(xml.replace(' daily.', ' daily. EDITED'));
      });
    }
  }

  it('an element whose content is only whitespace is still a chip (it has no text of its own)', () => {
    expect(chipsIn(DOC('<p>Use <keyword conkeyref="varsX/v1"> </keyword> daily.</p>')))
      .toEqual([{ refTag: 'keyword', refType: 'conkeyref', refValue: 'varsX/v1', text: ' ' }]);
  });

  it('an element with fallback text keeps today\'s stamped-text display', () => {
    const xml = DOC('<p>Use <keyword keyref="someKey">Fallback</keyword> daily.</p>');
    expect(chipsIn(xml)).toEqual([]);
    const { editor, originMap } = parse(xml);
    editor.getEditorState().read(() => {
      const t = findText($getRoot(), 'Fallback');
      expect(t).not.toBeNull();
      expect(originMap.get(t!.getKey())?.inlineTag).toBe('keyword');
    });
    expect(roundTrip(xml)).toBe(xml);
  });

  it('<ph>/<term> with a ref and text stay chips, as before, with refTag ph/term', () => {
    expect(chipsIn(DOC('<p>A <ph conkeyref="varsX/v1">old</ph> and <term keyref="k">t</term>.</p>'))).toEqual([
      { refTag: 'ph', refType: 'conkeyref', refValue: 'varsX/v1', text: 'old' },
      { refTag: 'term', refType: 'keyref', refValue: 'k', text: 't' },
    ]);
  });

  it('an <xref keyref/> is still a link, not a chip', () => {
    expect(chipsIn(DOC('<p>See <xref keyref="someKey"/>.</p>'))).toEqual([]);
  });

  it('an inline <image> chip records refTag image', () => {
    expect(chipsIn(DOC('<p>Icon <image href="a.png"/> here.</p>')).map(c => c.refTag)).toEqual(['image']);
  });

  it('an <image keyref/> stays an image chip, as before (not a ref chip)', () => {
    expect(chipsIn(DOC('<p>Icon <image keyref="logo"/> here.</p>')))
      .toEqual([{ refTag: 'image', refType: 'image', refValue: '', text: '' }]);
  });

  it('a ref-carrying <note> block chip records refTag note', () => {
    expect(chipsIn(DOC('<note conkeyref="varsNotes/n1"/>')).map(c => c.refTag)).toEqual(['note']);
  });
});

describe('BUG-46: author-created chips serialize as their element (FR-066 serializer half)', () => {
  const xml = DOC('<p>Open the menu now.</p>');

  for (const tag of ['uicontrol', 'keyword', 'wintitle', 'ph']) {
    it(`a new ${tag} chip becomes <${tag} conkeyref/> and nothing else changes`, () => {
      const out = editAndSerialize(xml, () => {
        const t = findText($getRoot(), 'Open the menu now.');
        if (!t) throw new Error('no text node');
        const [, after] = t.splitText('Open the '.length);
        after.insertBefore($createDitaPhRefNode('conkeyref', 'varsAltitudeUI/OptionsMenu', '', tag));
      });
      expect(out).toBe(xml.replace('Open the menu', `Open the <${tag} conkeyref="varsAltitudeUI/OptionsMenu"/>menu`));
    });
  }

  it('replacing a <keyword> chip by a <ph> chip with the same ref is a change (the signature includes the tag)', () => {
    const src = DOC('<p>Use <keyword conkeyref="varsX/v1"/> daily.</p>');
    const out = editAndSerialize(src, () => {
      const p = $getRoot().getChildren().find(c => c.getType() === 'paragraph');
      if (!p || !$isElementNode(p)) throw new Error('no paragraph');
      const chip = p.getChildren().find($isDitaPhRefNode);
      if (!chip) throw new Error('no chip');
      chip.replace($createDitaPhRefNode('conkeyref', 'varsX/v1', '', 'ph'));
    });
    expect(out).toBe(src.replace('<keyword conkeyref="varsX/v1"/>', '<ph conkeyref="varsX/v1"/>'));
  });
});

describe('BUG-46: DitaPhRefNode JSON', () => {
  it('exports refTag and imports state written before refTag existed as ph', () => {
    const editor = createTestEditor();
    editor.update(() => {
      const chip = $createDitaPhRefNode('conkeyref', 'varsX/v1', '', 'uicontrol');
      expect(chip.exportJSON()).toMatchObject({ refTag: 'uicontrol', refType: 'conkeyref', refValue: 'varsX/v1' });
      const legacy = DitaPhRefNode.importJSON({ type: 'ditaphref', version: 1, refType: 'conkeyref', refValue: 'varsX/v1', originalText: '' } as never);
      expect(legacy.getRefTag()).toBe('ph');
    }, { discrete: true });
  });
});

describe('BUG-46: corpus — every text-less ref-carrying inline element is now a chip', () => {
  const FIXTURES = join(__dirname, 'fixtures');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.dita')) files.push(p);
    }
  };
  walk(FIXTURES);

  it('finds the fixtures', () => {
    expect(files.length).toBeGreaterThanOrEqual(52);
  });

  // Counted from the corpus DOM on 2026-10-27 (every ref-carrying element by
  // tag, parent, and emptiness): 37 text-less <keyword conkeyref/keyref> inline
  // (18 in <p>, 13 in <shortdesc>, 4 in <cmd>, 2 in <result>) — the BUG-46
  // targets — and 71 ref <ph> (45 in <p>, 13 in <cmd>, 6 in <entry>, 5 in
  // <shortdesc>, 2 in <b>), which were chips already. The block-level refs
  // (<step>, <section>, <p>, <note>) take other paths and are not counted here.
  it('every text-less ref <keyword> in the corpus is a chip, and the ref <ph> chips are unchanged', () => {
    const byTag = new Map<string, number>();
    for (const f of files) {
      for (const c of chipsIn(readFileSync(f, 'utf-8'))) byTag.set(c.refTag, (byTag.get(c.refTag) ?? 0) + 1);
    }
    expect(byTag.get('keyword')).toBe(37);
    expect(byTag.get('ph')).toBe(71);
  });
});
