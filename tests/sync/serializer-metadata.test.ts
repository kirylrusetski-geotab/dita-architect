// @vitest-environment jsdom
//
// BUG-30 — no XML declaration is added when the source had none.
// BUG-41 — a CALS table's <tgroup cols> is rewritten only when the editor's
// column count actually differs from what the source's own first row
// represents, not on every serialize.
import { describe, it, expect } from 'vitest';
import { $getRoot, $isElementNode } from 'lexical';
import { createTestEditor, roundTrip } from '../helpers/createTestEditor';
import { parseXmlToLexical } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../../sync/nodeOriginMap';

describe('BUG-30 — no XML declaration when the source had none', () => {
  const NO_DECL = '<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="c"><title>T</title><conbody><p>Text</p></conbody></concept>';
  const WITH_DECL = `<?xml version="1.0" encoding="UTF-8"?>\n${NO_DECL}`;

  it('unedited: byte-stable, still no declaration', () => {
    expect(roundTrip(NO_DECL)).toBe(NO_DECL);
  });

  it('edited: the output still has no declaration', () => {
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(NO_DECL, editor, originMap, true);
    editor.update(() => {
      const p = $getRoot().getChildren().find(c => c.getTextContent() === 'Text');
      if (!p || !$isElementNode(p)) throw new Error('no paragraph');
      (p.getFirstChild() as any).setTextContent('Text edited');
    }, { discrete: true });
    const out = serializeLexicalToXml(editor.getEditorState(), NO_DECL, originMap, createXmlMetaCache());
    expect(out).toBe(NO_DECL.replace('Text', 'Text edited'));
    expect(out.startsWith('<?xml')).toBe(false);
  });

  it('a source that DOES have a declaration keeps it (unchanged behaviour)', () => {
    expect(roundTrip(WITH_DECL)).toBe(WITH_DECL);
  });

  it('a source with a declaration keeps it after an edit too', () => {
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(WITH_DECL, editor, originMap, true);
    editor.update(() => {
      const p = $getRoot().getChildren().find(c => c.getTextContent() === 'Text');
      if (!p || !$isElementNode(p)) throw new Error('no paragraph');
      (p.getFirstChild() as any).setTextContent('Text edited');
    }, { discrete: true });
    const out = serializeLexicalToXml(editor.getEditorState(), WITH_DECL, originMap, createXmlMetaCache());
    expect(out).toBe(WITH_DECL.replace('Text', 'Text edited'));
  });
});

describe('BUG-41 — <tgroup cols> is rewritten only when the count actually changed', () => {
  const DOC = (body: string) =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="c"><title>T</title><conbody>${body}</conbody></concept>`;

  it('a source whose cols disagrees with its real row count is left exactly as it was, unedited', () => {
    const xml = DOC('<table><tgroup cols="1"><tbody><row><entry>A</entry><entry>B</entry></row></tbody></tgroup></table>');
    expect(roundTrip(xml)).toBe(xml);
  });

  it('editing a cell in that same table does not "fix" the mismatched cols', () => {
    const xml = DOC('<table><tgroup cols="1"><tbody><row><entry>A</entry><entry>B</entry></row></tbody></tgroup></table>');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.update(() => {
      const table: any = $getRoot().getChildren().find((c: any) => c.getType() === 'table');
      const row: any = table.getFirstChild();
      const firstCellPara: any = row.getFirstChild().getFirstChild();
      firstCellPara.getFirstChild().setTextContent('A2');
    }, { discrete: true });
    const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
    expect(out).toBe(xml.replace('>A<', '>A2<'));
  });

  it('a correct cols value stays correct, unedited', () => {
    const xml = DOC('<table><tgroup cols="2"><colspec colname="c1"/><colspec colname="c2"/><tbody><row><entry>A</entry><entry>B</entry></row></tbody></tgroup></table>');
    expect(roundTrip(xml)).toBe(xml);
  });

  it('a correct cols value stays correct after an unrelated cell edit', () => {
    const xml = DOC('<table><tgroup cols="2"><colspec colname="c1"/><colspec colname="c2"/><tbody><row><entry>A</entry><entry>B</entry></row></tbody></tgroup></table>');
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(xml, editor, originMap, true);
    editor.update(() => {
      const table: any = $getRoot().getChildren().find((c: any) => c.getType() === 'table');
      const row: any = table.getFirstChild();
      const firstCellPara: any = row.getFirstChild().getFirstChild();
      firstCellPara.getFirstChild().setTextContent('A2');
    }, { discrete: true });
    const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
    expect(out).toBe(xml.replace('>A<', '>A2<'));
    expect(out).toContain('cols="2"');
  });

  it('a simpletable (no @cols attribute at all) is untouched by the cols logic', () => {
    const xml = DOC('<simpletable><strow><stentry>A</stentry><stentry>B</stentry></strow></simpletable>');
    expect(roundTrip(xml)).toBe(xml);
  });
});
