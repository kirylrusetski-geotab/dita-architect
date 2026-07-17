// FR-046 Phase 1 — TrackedTextNode unit tests.
//
// These pin the verified Lexical 0.16 behaviors the marks-as-data model
// depends on: splitText subclass preservation (overridden), normalization
// never merging marks into plain text, and JSON round-trip of the mark.
import { describe, it, expect } from 'vitest';
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  $isTextNode,
} from 'lexical';
import { createTestEditor } from '../helpers/createTestEditor';
import {
  TrackedTextNode,
  $createTrackedTextNode,
  $isTrackedTextNode,
  type SerializedTrackedTextNode,
} from '../../components/TrackedTextNode';
import { newMark } from '../../lib/tracked-changes/model';

describe('TrackedTextNode', () => {
  it('has type tracked-text and passes $isTextNode (instanceof)', () => {
    const editor = createTestEditor();
    editor.update(
      () => {
        const node = $createTrackedTextNode('hello', newMark('insert'));
        expect(node.getType()).toBe('tracked-text');
        expect($isTextNode(node)).toBe(true);
        expect($isTrackedTextNode(node)).toBe(true);
        expect($isTrackedTextNode($createTextNode('plain'))).toBe(false);
      },
      { discrete: true },
    );
  });

  it('insert marks are normal mode; delete and split marks are token mode', () => {
    const editor = createTestEditor();
    editor.update(
      () => {
        expect($createTrackedTextNode('a', newMark('insert')).getMode()).toBe('normal');
        expect($createTrackedTextNode('b', newMark('delete')).getMode()).toBe('token');
        expect($createTrackedTextNode('', newMark('split')).getMode()).toBe('token');
      },
      { discrete: true },
    );
  });

  it('splitText returns only TrackedTextNodes all carrying the same changeId', () => {
    const editor = createTestEditor();
    const mark = newMark('insert');
    editor.update(
      () => {
        const p = $createParagraphNode();
        const node = $createTrackedTextNode('hello world', mark);
        p.append(node);
        $getRoot().append(p);

        const parts = node.splitText(5);
        expect(parts).toHaveLength(2);
        for (const part of parts) {
          expect($isTrackedTextNode(part)).toBe(true);
          expect((part as TrackedTextNode).getMark().changeId).toBe(mark.changeId);
        }
        expect(parts[0].getTextContent()).toBe('hello');
        expect(parts[1].getTextContent()).toBe(' world');
      },
      { discrete: true },
    );
  });

  it('splitText mid-delete-mark preserves token mode and mark on every part', () => {
    const editor = createTestEditor();
    const mark = newMark('delete');
    editor.update(
      () => {
        const p = $createParagraphNode();
        const node = $createTrackedTextNode('struck text', mark);
        p.append(node);
        $getRoot().append(p);

        const parts = node.splitText(6);
        expect(parts).toHaveLength(2);
        for (const part of parts) {
          expect($isTrackedTextNode(part)).toBe(true);
          expect((part as TrackedTextNode).getMark().kind).toBe('delete');
          expect((part as TrackedTextNode).getMark().changeId).toBe(mark.changeId);
          expect(part.getMode()).toBe('token');
        }
      },
      { discrete: true },
    );
  });

  it('exportJSON/importJSON round-trips the mark payload, format, and mode', () => {
    const editor = createTestEditor();
    const mark = newMark('delete');
    editor.update(
      () => {
        const node = $createTrackedTextNode('gone', mark);
        node.setFormat(1); // bold

        const json = node.exportJSON() as SerializedTrackedTextNode;
        expect(json.type).toBe('tracked-text');
        expect(json.mark).toEqual(mark);

        const revived = TrackedTextNode.importJSON(json);
        expect(revived.getMark()).toEqual(mark);
        expect(revived.getTextContent()).toBe('gone');
        expect(revived.getFormat()).toBe(1);
        expect(revived.getMode()).toBe('token');
      },
      { discrete: true },
    );
  });

  it('normalization does NOT merge a mark with an adjacent plain TextNode', () => {
    const editor = createTestEditor();
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append(
          $createTextNode('before '),
          $createTrackedTextNode('inserted', newMark('insert')),
          $createTextNode(' after'),
        );
        $getRoot().append(p);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const p = $getRoot().getFirstChild();
      const children = (p as ReturnType<typeof $createParagraphNode>).getChildren();
      expect(children).toHaveLength(3);
      expect($isTrackedTextNode(children[0])).toBe(false);
      expect($isTrackedTextNode(children[1])).toBe(true);
      expect($isTrackedTextNode(children[2])).toBe(false);
      expect(p!.getTextContent()).toBe('before inserted after');
    });
  });

  it('an empty split marker survives an update cycle (not garbage-collected)', () => {
    const editor = createTestEditor();
    const mark = newMark('split');
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append($createTrackedTextNode('', mark), $createTextNode('block content'));
        $getRoot().append(p);
      },
      { discrete: true },
    );

    // A second, unrelated update gives normalization another chance to GC it.
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append($createTextNode('second block'));
        $getRoot().append(p);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const first = $getRoot().getFirstChild();
      const children = (first as ReturnType<typeof $createParagraphNode>).getChildren();
      expect($isTrackedTextNode(children[0])).toBe(true);
      expect((children[0] as TrackedTextNode).getMark().kind).toBe('split');
      expect(children[0].getTextContent()).toBe('');
    });
  });

  it('clone preserves the mark (EditorState snapshots keep tracked identity)', () => {
    const editor = createTestEditor();
    const mark = newMark('insert');
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append($createTrackedTextNode('cloned', mark));
        $getRoot().append(p);
      },
      { discrete: true },
    );

    // getWritable() in a fresh update triggers clone()
    editor.update(
      () => {
        const p = $getRoot().getFirstChild();
        const node = (p as ReturnType<typeof $createParagraphNode>).getChildren()[0] as TrackedTextNode;
        const writable = node.getWritable();
        expect(writable.getMark()).toEqual(mark);
      },
      { discrete: true },
    );
  });
});
