// FR-046 Phase 3 — defensive serializer behavior when marks are present.
//
// Marks never reach serialization in practice (sync is suspended during
// suggesting mode; accept/reject-all resolves everything before the one
// serialize call). These tests pin the defensive behavior for the
// should-never-happen path: struck text must NOT leak into XML, insert-mark
// text serializes as plain content, and the document stays valid.
import { describe, it, expect } from 'vitest';
import { $getRoot, type ParagraphNode, type TextNode } from 'lexical';
import { createTestEditor } from '../helpers/createTestEditor';
import { parseXmlToLexical } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../../sync/nodeOriginMap';
import {
  $insertTrackedText,
  $markRangeAsDeleted,
} from '../../lib/tracked-changes/edits';
import { validateDitaXml } from '../../lib/xml-utils';

const TOPIC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="guard_test">
  <title>Serializer guard topic</title>
  <conbody>
    <p>Alpha bravo charlie delta.</p>
  </conbody>
</concept>`;

function setup() {
  const editor = createTestEditor();
  const originMap = createNodeOriginMap();
  const cache = createXmlMetaCache();
  parseXmlToLexical(TOPIC_XML, editor, originMap, true);
  return { editor, originMap, cache };
}

function $bodyParagraph(): ParagraphNode {
  return $getRoot()
    .getChildren()
    .find(n => n.getType() === 'paragraph') as ParagraphNode;
}

describe('serializer guard for unresolved tracked marks', () => {
  it('a delete mark reaching the serializer leaves the document unchanged (suggestion not applied)', () => {
    const { editor, originMap, cache } = setup();
    editor.update(
      () => {
        const t = $bodyParagraph().getFirstChild() as TextNode;
        const sel = t.select(6, 12); // "bravo "
        $markRangeAsDeleted(sel);
      },
      { discrete: true },
    );

    const xml = serializeLexicalToXml(editor.getEditorState(), TOPIC_XML, originMap, cache);
    // Kept-and-struck text still counts as document content (getTextContent
    // includes it), so the patch path sees "unchanged" and preserves the
    // original bytes — an unresolved delete suggestion is NOT silently
    // applied, and nothing is duplicated.
    expect(xml).toContain('Alpha bravo charlie delta.');
    expect(xml).not.toContain('bravo bravo');
    expect(validateDitaXml(xml).valid).toBe(true);
  });

  it('an insert mark reaching the serializer is emitted as plain text content', () => {
    const { editor, originMap, cache } = setup();
    editor.update(
      () => {
        const t = $bodyParagraph().getFirstChild() as TextNode;
        const sel = t.select(5, 5); // after "Alpha"
        $insertTrackedText(sel, ' INSERTED');
      },
      { discrete: true },
    );

    const xml = serializeLexicalToXml(editor.getEditorState(), TOPIC_XML, originMap, cache);
    expect(xml).toContain('Alpha INSERTED bravo charlie delta.');
    expect(validateDitaXml(xml).valid).toBe(true);
  });
});
