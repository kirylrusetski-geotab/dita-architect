// FR-046 — derive the change list by scanning the tree for marks.
//
// Identity is the changeId carried on each TrackedTextNode — never Lexical
// node keys, which churn on structural edits. The list is rebuildable from
// the document alone (the core marks-as-data property).
//
// Must be called inside editor.getEditorState().read() or editor.update().
import { $getRoot, $isElementNode, type LexicalNode } from 'lexical';
import { $isTrackedTextNode } from '../../components/TrackedTextNode';
import type { Change } from './model';

export function $scanTrackedChanges(): Change[] {
  const changes = new Map<string, Change>();

  const visit = (node: LexicalNode): void => {
    if ($isTrackedTextNode(node)) {
      const mark = node.getMark();
      // ADR-015 decision 8: one changeId can carry two kinds (Heretto writes
      // a replace as a ct-ins + ct-del pair sharing the id), so a change is
      // keyed by both. Mutations still act on the whole changeId.
      const key = `${mark.changeId}\u0000${mark.kind}`;
      const existing = changes.get(key);
      if (existing) {
        existing.text += node.getTextContent();
      } else {
        changes.set(key, {
          changeId: mark.changeId,
          kind: mark.kind,
          text: node.getTextContent(),
          author: mark.author,
          date: mark.date,
          firstNodeKey: node.getKey(),
        });
      }
      return;
    }
    if ($isElementNode(node)) {
      for (const child of node.getChildren()) {
        visit(child);
      }
    }
  };

  for (const child of $getRoot().getChildren()) {
    visit(child);
  }

  // Map preserves insertion order = depth-first document order.
  return [...changes.values()];
}
