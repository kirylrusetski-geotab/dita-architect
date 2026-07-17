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
      const existing = changes.get(mark.changeId);
      if (existing) {
        existing.text += node.getTextContent();
      } else {
        changes.set(mark.changeId, {
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
