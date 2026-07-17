// FR-046 Phase 2 — suggesting-mode write path (lib/tracked-changes/edits.ts).
//
// Drives the edit functions headlessly: build a tree, set a real
// RangeSelection, call the edit function inside editor.update, assert on the
// resulting tree. No DOM, no plugin — pure model behavior.
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
import { createTestEditor } from '../helpers/createTestEditor';
import {
  $insertTrackedText,
  $markCollapsedDeletion,
  $markRangeAsDeleted,
  $trackedParagraphSplit,
} from '../../lib/tracked-changes/edits';
import { $rejectChange, $acceptChange } from '../../lib/tracked-changes/mutations';
import { $isTrackedTextNode, TrackedTextNode } from '../../components/TrackedTextNode';

/** Build an editor whose root holds one paragraph containing `text`. */
function editorWithParagraph(text: string) {
  const editor = createTestEditor();
  editor.update(
    () => {
      const p = $createParagraphNode();
      p.append($createTextNode(text));
      $getRoot().append(p);
    },
    { discrete: true },
  );
  return editor;
}

function $firstParagraph(): ParagraphNode {
  return $getRoot().getFirstChild() as ParagraphNode;
}

function $selection(): RangeSelection {
  let sel = $getSelection();
  if (!$isRangeSelection(sel)) {
    // Headless artifact: a fresh update() re-derives selection from the DOM,
    // which doesn't exist here — restore the previous state's selection, which
    // is what the browser command path would have live anyway.
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

describe('$insertTrackedText', () => {
  it('typing mid-plain-node produces plain/mark/plain, original node keeps its key (Gate 6)', () => {
    const editor = editorWithParagraph('Hello world');
    let originalKey = '';
    editor.update(
      () => {
        const textNode = $firstParagraph().getFirstChild() as TextNode;
        originalKey = textNode.getKey();
        textNode.select(5, 5); // after "Hello"
        $insertTrackedText($selection(), ' brave');
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const children = $firstParagraph().getChildren();
      expect(children).toHaveLength(3);
      expect($isTrackedTextNode(children[0])).toBe(false);
      expect(children[0].getKey()).toBe(originalKey); // splitText part 1 mutates in place
      expect(children[0].getTextContent()).toBe('Hello');
      expect($isTrackedTextNode(children[1])).toBe(true);
      expect(children[1].getTextContent()).toBe(' brave');
      expect((children[1] as TrackedTextNode).getMark().kind).toBe('insert');
      expect($isTrackedTextNode(children[2])).toBe(false);
      expect(children[2].getTextContent()).toBe(' world');
      expect($firstParagraph().getTextContent()).toBe('Hello brave world');
    });
  });

  it('consecutive typing extends ONE mark node with ONE changeId', () => {
    const editor = editorWithParagraph('xy');
    editor.update(
      () => {
        (($firstParagraph().getFirstChild()) as TextNode).select(1, 1);
        $insertTrackedText($selection(), 'a');
      },
      { discrete: true },
    );
    editor.update(
      () => {
        // Caret was left inside the mark by the first insert.
        $insertTrackedText($selection(), 'b');
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const marks = $firstParagraph()
        .getChildren()
        .filter($isTrackedTextNode) as TrackedTextNode[];
      expect(marks).toHaveLength(1);
      expect(marks[0].getTextContent()).toBe('ab');
      expect($firstParagraph().getTextContent()).toBe('xaby');
    });
  });

  it('typing at a boundary adjacent to an own insert mark merges into it', () => {
    const editor = editorWithParagraph('start');
    editor.update(
      () => {
        (($firstParagraph().getFirstChild()) as TextNode).select(5, 5);
        $insertTrackedText($selection(), 'A');
      },
      { discrete: true },
    );
    editor.update(
      () => {
        // Place caret explicitly at the END of the plain node (offset 5),
        // whose next sibling is the insert mark.
        const plain = $firstParagraph().getFirstChild() as TextNode;
        plain.select(5, 5);
        $insertTrackedText($selection(), 'B');
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const marks = $firstParagraph()
        .getChildren()
        .filter($isTrackedTextNode) as TrackedTextNode[];
      expect(marks).toHaveLength(1);
      expect(marks[0].getTextContent()).toBe('BA');
    });
  });
});

describe('$markCollapsedDeletion', () => {
  it('backspace converts one plain char to a delete mark; second backspace merges (one changeId)', () => {
    const editor = editorWithParagraph('hello');
    editor.update(
      () => {
        (($firstParagraph().getFirstChild()) as TextNode).select(5, 5);
        const r1 = $markCollapsedDeletion($selection(), true);
        expect(r1.status).toBe('ok');
      },
      { discrete: true },
    );
    editor.update(
      () => {
        const r2 = $markCollapsedDeletion($selection(), true);
        expect(r2.status).toBe('ok');
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const marks = $firstParagraph()
        .getChildren()
        .filter($isTrackedTextNode) as TrackedTextNode[];
      expect(marks).toHaveLength(1);
      expect(marks[0].getMark().kind).toBe('delete');
      expect(marks[0].getTextContent()).toBe('lo'); // struck in original order
      expect($firstParagraph().getTextContent()).toBe('hello'); // 'hel' + struck 'lo'
    });
  });

  it('backspace over an own insert mark really removes text (retraction, no delete mark)', () => {
    const editor = editorWithParagraph('xy');
    editor.update(
      () => {
        (($firstParagraph().getFirstChild()) as TextNode).select(1, 1);
        $insertTrackedText($selection(), 'ab');
      },
      { discrete: true },
    );
    editor.update(
      () => {
        // caret sits at end of the insert mark ('ab')
        $markCollapsedDeletion($selection(), true);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const marks = $firstParagraph()
        .getChildren()
        .filter($isTrackedTextNode) as TrackedTextNode[];
      expect(marks).toHaveLength(1);
      expect(marks[0].getMark().kind).toBe('insert');
      expect(marks[0].getTextContent()).toBe('a'); // 'b' retracted
      expect(
        $firstParagraph()
          .getChildren()
          .filter(n => $isTrackedTextNode(n) && n.getMark().kind === 'delete'),
      ).toHaveLength(0);
    });
  });

  it('forward-delete against an existing delete mark hops the caret without mutation', () => {
    const editor = editorWithParagraph('hello');
    editor.update(
      () => {
        (($firstParagraph().getFirstChild()) as TextNode).select(5, 5);
        $markCollapsedDeletion($selection(), true); // strikes 'o', caret before the mark
      },
      { discrete: true },
    );
    editor.update(
      () => {
        const r = $markCollapsedDeletion($selection(), false); // forward into the mark
        expect(r.status).toBe('hopped');
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const marks = $firstParagraph()
        .getChildren()
        .filter($isTrackedTextNode) as TrackedTextNode[];
      expect(marks).toHaveLength(1);
      expect(marks[0].getTextContent()).toBe('o'); // unchanged
    });
  });

  it('backspace at the start of the first block reports blocked-boundary', () => {
    const editor = editorWithParagraph('text');
    editor.update(
      () => {
        (($firstParagraph().getFirstChild()) as TextNode).select(0, 0);
        const r = $markCollapsedDeletion($selection(), true);
        expect(r.status).toBe('blocked-boundary');
      },
      { discrete: true },
    );
  });
});

describe('$markRangeAsDeleted', () => {
  it('mixed range: plain segments become delete marks (one gesture changeId), own insert is retracted', () => {
    const editor = editorWithParagraph('Hello world');
    editor.update(
      () => {
        (($firstParagraph().getFirstChild()) as TextNode).select(5, 5);
        $insertTrackedText($selection(), 'XYZ'); // Hello|XYZ| world
      },
      { discrete: true },
    );
    editor.update(
      () => {
        // Select from "llo" through XYZ into " wo": children are
        // [plain 'Hello'][insert 'XYZ'][plain ' world']
        const children = $firstParagraph().getChildren();
        const first = children[0] as TextNode;
        const last = children[2] as TextNode;
        const sel = first.select(2, 2);
        sel.focus.set(last.getKey(), 3, 'text'); // through ' wo'
        const { sawDecorator, gestureMark } = $markRangeAsDeleted(sel);
        expect(sawDecorator).toBe(false);

        // All delete marks created share the gesture's changeId
        const marks = $firstParagraph()
          .getChildren()
          .filter(n => $isTrackedTextNode(n) && n.getMark().kind === 'delete') as TrackedTextNode[];
        expect(marks.length).toBeGreaterThanOrEqual(2);
        for (const m of marks) {
          expect(m.getMark().changeId).toBe(gestureMark.changeId);
        }
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      // XYZ (own insert) is gone entirely; struck text still present visually
      expect($firstParagraph().getTextContent()).toBe('Hello world');
      const inserts = $firstParagraph()
        .getChildren()
        .filter(n => $isTrackedTextNode(n) && n.getMark().kind === 'insert');
      expect(inserts).toHaveLength(0);
    });
  });

  it('replace-typing: range delete then insert yields delete marks + adjacent insert mark', () => {
    const editor = editorWithParagraph('Hello world');
    editor.update(
      () => {
        const textNode = $firstParagraph().getFirstChild() as TextNode;
        const sel = textNode.select(0, 5); // select "Hello"
        const { lastMarkNode } = $markRangeAsDeleted(sel);
        expect(lastMarkNode).not.toBeNull();
        $insertTrackedText($selection(), 'Howdy');
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const children = $firstParagraph().getChildren();
      const kinds = children.map(n =>
        $isTrackedTextNode(n) ? (n as TrackedTextNode).getMark().kind : 'plain',
      );
      expect(kinds).toEqual(['delete', 'insert', 'plain']);
      expect(children[0].getTextContent()).toBe('Hello');
      expect(children[1].getTextContent()).toBe('Howdy');
      expect(children[2].getTextContent()).toBe(' world');
    });
  });
});

describe('$trackedParagraphSplit', () => {
  it('Enter splits the block and heads the new block with a split marker', () => {
    const editor = editorWithParagraph('First Second');
    editor.update(
      () => {
        (($firstParagraph().getFirstChild()) as TextNode).select(6, 6);
        $trackedParagraphSplit($selection());
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const blocks = $getRoot().getChildren();
      expect(blocks).toHaveLength(2);
      expect(blocks[0].getTextContent()).toBe('First ');
      const secondChildren = (blocks[1] as ParagraphNode).getChildren();
      expect($isTrackedTextNode(secondChildren[0])).toBe(true);
      expect((secondChildren[0] as TrackedTextNode).getMark().kind).toBe('split');
      expect(blocks[1].getTextContent()).toBe('Second');
    });
  });

  it('reject restores the single block byte-identical; accept keeps two clean blocks', () => {
    // Reject path
    const editorA = editorWithParagraph('First Second');
    let changeIdA = '';
    editorA.update(
      () => {
        (($firstParagraph().getFirstChild()) as TextNode).select(6, 6);
        $trackedParagraphSplit($selection());
        const marker = ($getRoot().getChildren()[1] as ParagraphNode)
          .getChildren()
          .find($isTrackedTextNode) as TrackedTextNode;
        changeIdA = marker.getMark().changeId;
      },
      { discrete: true },
    );
    editorA.update(
      () => {
        $rejectChange(changeIdA);
      },
      { discrete: true },
    );
    editorA.getEditorState().read(() => {
      const blocks = $getRoot().getChildren();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].getTextContent()).toBe('First Second');
    });

    // Accept path
    const editorB = editorWithParagraph('First Second');
    let changeIdB = '';
    editorB.update(
      () => {
        (($firstParagraph().getFirstChild()) as TextNode).select(6, 6);
        $trackedParagraphSplit($selection());
        const marker = ($getRoot().getChildren()[1] as ParagraphNode)
          .getChildren()
          .find($isTrackedTextNode) as TrackedTextNode;
        changeIdB = marker.getMark().changeId;
      },
      { discrete: true },
    );
    editorB.update(
      () => {
        $acceptChange(changeIdB);
      },
      { discrete: true },
    );
    editorB.getEditorState().read(() => {
      const blocks = $getRoot().getChildren();
      expect(blocks).toHaveLength(2);
      expect(blocks[0].getTextContent()).toBe('First ');
      expect(blocks[1].getTextContent()).toBe('Second');
      expect(
        blocks.flatMap(b => (b as ParagraphNode).getChildren()).filter($isTrackedTextNode),
      ).toHaveLength(0);
    });
  });

  it('backspace immediately after your own split marker rejects that split', () => {
    const editor = editorWithParagraph('First Second');
    editor.update(
      () => {
        (($firstParagraph().getFirstChild()) as TextNode).select(6, 6);
        $trackedParagraphSplit($selection());
      },
      { discrete: true },
    );
    let rejectedId = '';
    editor.update(
      () => {
        // Caret is right after the marker (element point index 1)
        const r = $markCollapsedDeletion($selection(), true);
        expect(r.status).toBe('reject-split');
        if (r.status === 'reject-split') rejectedId = r.changeId;
        $rejectChange(rejectedId);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const blocks = $getRoot().getChildren();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].getTextContent()).toBe('First Second');
    });
  });
});
