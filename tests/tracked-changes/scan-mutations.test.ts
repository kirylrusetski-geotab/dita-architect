// FR-046 Phase 2 — change list scan + accept/reject mutations.
//
// Includes the FR's core promise as a test: parse a DITA topic, make
// suggestions, REJECT ALL → serialized XML is byte-equal to the unedited
// round-trip. And accept-all parity: accepting suggestions serializes the
// same as making the identical edits directly.
import { describe, it, expect } from 'vitest';
import {
  $getRoot,
  $getSelection,
  $getPreviousSelection,
  $setSelection,
  $createParagraphNode,
  $createTextNode,
  $isRangeSelection,
  type ParagraphNode,
  type RangeSelection,
  type TextNode,
} from 'lexical';
import { createTestEditor, roundTrip } from '../helpers/createTestEditor';
import { parseXmlToLexical } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../../sync/nodeOriginMap';
import {
  $insertTrackedText,
  $markCollapsedDeletion,
  $markRangeAsDeleted,
} from '../../lib/tracked-changes/edits';
import { $scanTrackedChanges } from '../../lib/tracked-changes/scan';
import {
  $acceptChange,
  $rejectChange,
  $acceptAllChanges,
  $rejectAllChanges,
} from '../../lib/tracked-changes/mutations';
import { $isTrackedTextNode, TrackedTextNode } from '../../components/TrackedTextNode';

const TOPIC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="fr046_test">
  <title>Tracked changes test topic</title>
  <conbody>
    <p>The quick brown fox jumps over the lazy dog.</p>
    <p>Second paragraph with steady content.</p>
  </conbody>
</concept>`;

function $selection(): RangeSelection {
  let sel = $getSelection();
  if (!$isRangeSelection(sel)) {
    const prev = $getPreviousSelection();
    if ($isRangeSelection(prev)) {
      const clone = prev.clone();
      $setSelection(clone);
      sel = clone;
    }
  }
  if (!$isRangeSelection(sel)) throw new Error('expected a RangeSelection');
  return sel;
}

/** All body paragraphs (skipping the H1 title) in a parsed topic. */
function $bodyParagraphs(): ParagraphNode[] {
  return $getRoot()
    .getChildren()
    .filter(n => n.getType() === 'paragraph') as ParagraphNode[];
}

describe('$scanTrackedChanges', () => {
  it('groups multi-node changes by changeId in document order', () => {
    const editor = createTestEditor();
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append($createTextNode('one two three four'));
        $getRoot().append(p);
      },
      { discrete: true },
    );
    editor.update(
      () => {
        // Range-delete "two three" — but with an own insert in the middle it
        // produces MULTIPLE delete-mark nodes sharing one changeId. Simulate
        // simply: strike "two ", then extend by striking "three " into the
        // same run via a second range gesture with the same mark.
        const t = ($getRoot().getFirstChild() as ParagraphNode).getFirstChild() as TextNode;
        const sel = t.select(4, 8); // "two "
        const { gestureMark } = $markRangeAsDeleted(sel);
        // second segment, same gesture mark (as PASTE-over-range would do)
        const children = ($getRoot().getFirstChild() as ParagraphNode).getChildren();
        const tail = children[children.length - 1] as TextNode;
        const sel2 = tail.select(0, 6); // "three "
        $markRangeAsDeleted(sel2, gestureMark);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const changes = $scanTrackedChanges();
      expect(changes).toHaveLength(1);
      expect(changes[0].kind).toBe('delete');
      expect(changes[0].text).toBe('two three ');
    });
  });

  it('rescan after an unrelated edit yields the identical change list (identity ≠ node keys)', () => {
    const editor = createTestEditor();
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append($createTextNode('alpha beta'));
        $getRoot().append(p);
      },
      { discrete: true },
    );
    editor.update(
      () => {
        const t = ($getRoot().getFirstChild() as ParagraphNode).getFirstChild() as TextNode;
        t.select(5, 5);
        $insertTrackedText($selection(), ' INSERTED');
      },
      { discrete: true },
    );

    let before: string[] = [];
    editor.getEditorState().read(() => {
      before = $scanTrackedChanges().map(c => `${c.changeId}:${c.kind}:${c.text}`);
    });

    // Unrelated edit: append a new paragraph elsewhere.
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append($createTextNode('unrelated content'));
        $getRoot().append(p);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const after = $scanTrackedChanges().map(c => `${c.changeId}:${c.kind}:${c.text}`);
      expect(after).toEqual(before);
    });
  });
});

describe('accept/reject mutations', () => {
  it('accept-insert strips the mark and preserves format; text becomes plain', () => {
    const editor = createTestEditor();
    let changeId = '';
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append($createTextNode('before after'));
        $getRoot().append(p);
        const t = p.getFirstChild() as TextNode;
        t.select(7, 7);
        $insertTrackedText($selection(), 'BOLD');
        const mark = p.getChildren().find($isTrackedTextNode) as TrackedTextNode;
        mark.setFormat(1); // bold
        changeId = mark.getMark().changeId;
      },
      { discrete: true },
    );
    editor.update(
      () => {
        $acceptChange(changeId);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const p = $getRoot().getFirstChild() as ParagraphNode;
      expect(p.getChildren().filter($isTrackedTextNode)).toHaveLength(0);
      expect(p.getTextContent()).toBe('before BOLDafter');
      const bold = p.getChildren().find(n => (n as TextNode).getFormat?.() === 1);
      expect(bold).toBeDefined();
      expect(bold!.getTextContent()).toBe('BOLD');
    });
  });

  it('single-change accept leaves other changes untouched', () => {
    const editor = createTestEditor();
    let firstId = '';
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append($createTextNode('one two'));
        $getRoot().append(p);
        const t = p.getFirstChild() as TextNode;
        t.select(3, 3);
        $insertTrackedText($selection(), ' FIRST');
      },
      { discrete: true },
    );
    editor.update(
      () => {
        const p = $getRoot().getFirstChild() as ParagraphNode;
        const tail = p.getLastChild() as TextNode;
        tail.select(tail.getTextContentSize(), tail.getTextContentSize());
        $insertTrackedText($selection(), ' SECOND');
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const changes = $scanTrackedChanges();
      expect(changes).toHaveLength(2);
      firstId = changes[0].changeId;
    });

    editor.update(
      () => {
        $acceptChange(firstId);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const changes = $scanTrackedChanges();
      expect(changes).toHaveLength(1);
      expect(changes[0].text).toBe(' SECOND');
      const p = $getRoot().getFirstChild() as ParagraphNode;
      expect(p.getTextContent()).toBe('one FIRST two SECOND');
    });
  });

  it('CORE: suggest edits on a parsed topic → reject all → serialize byte-equal to unedited round-trip', () => {
    const baseline = roundTrip(TOPIC_XML);

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(TOPIC_XML, editor, originMap, true);

    // Suggest: insert into paragraph 1, strike a char in paragraph 2.
    editor.update(
      () => {
        const paras = $bodyParagraphs();
        const t1 = paras[0].getFirstChild() as TextNode;
        t1.select(9, 9); // after "The quick"
        $insertTrackedText($selection(), ' extremely');
      },
      { discrete: true },
    );
    editor.update(
      () => {
        const paras = $bodyParagraphs();
        const t2 = paras[1].getFirstChild() as TextNode;
        t2.select(6, 6);
        $markCollapsedDeletion($selection(), true); // strike one char
      },
      { discrete: true },
    );

    // Sanity: two changes exist.
    editor.getEditorState().read(() => {
      expect($scanTrackedChanges()).toHaveLength(2);
    });

    editor.update(
      () => {
        $rejectAllChanges();
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      expect($scanTrackedChanges()).toHaveLength(0);
    });

    const rejected = serializeLexicalToXml(editor.getEditorState(), TOPIC_XML, originMap, cache);
    expect(rejected).toBe(baseline);
  });

  it('CORE: accept-all serializes identically to making the same edits directly', () => {
    // Editor A: suggest + accept-all
    const editorA = createTestEditor();
    const originMapA = createNodeOriginMap();
    const cacheA = createXmlMetaCache();
    parseXmlToLexical(TOPIC_XML, editorA, originMapA, true);
    editorA.update(
      () => {
        const paras = $bodyParagraphs();
        const t1 = paras[0].getFirstChild() as TextNode;
        t1.select(9, 9);
        $insertTrackedText($selection(), ' extremely');
      },
      { discrete: true },
    );
    editorA.update(
      () => {
        $acceptAllChanges();
      },
      { discrete: true },
    );
    const acceptedXml = serializeLexicalToXml(editorA.getEditorState(), TOPIC_XML, originMapA, cacheA);

    // Editor B: the same edit made directly (no suggesting)
    const editorB = createTestEditor();
    const originMapB = createNodeOriginMap();
    const cacheB = createXmlMetaCache();
    parseXmlToLexical(TOPIC_XML, editorB, originMapB, true);
    editorB.update(
      () => {
        const paras = $bodyParagraphs();
        const t1 = paras[0].getFirstChild() as TextNode;
        t1.spliceText(9, 0, ' extremely', false);
      },
      { discrete: true },
    );
    const directXml = serializeLexicalToXml(editorB.getEditorState(), TOPIC_XML, originMapB, cacheB);

    expect(acceptedXml).toBe(directXml);
    expect(acceptedXml).toContain('The quick extremely brown fox');
  });

  it('reject-delete resurrects struck text as plain, format preserved', () => {
    const editor = createTestEditor();
    let changeId = '';
    editor.update(
      () => {
        const p = $createParagraphNode();
        const t = $createTextNode('keep this text');
        t.setFormat(2); // italic
        p.append(t);
        $getRoot().append(p);
        const sel = t.select(5, 9); // "this"
        const { gestureMark } = $markRangeAsDeleted(sel);
        changeId = gestureMark.changeId;
      },
      { discrete: true },
    );
    editor.update(
      () => {
        $rejectChange(changeId);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const p = $getRoot().getFirstChild() as ParagraphNode;
      expect(p.getChildren().filter($isTrackedTextNode)).toHaveLength(0);
      expect(p.getTextContent()).toBe('keep this text');
      for (const child of p.getChildren()) {
        expect((child as TextNode).getFormat()).toBe(2); // italic preserved on all parts
      }
    });
  });
});
