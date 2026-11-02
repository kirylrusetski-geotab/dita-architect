// FR-046 — accept/reject as explicit, atomic model mutations.
//
// Every mutation locates its nodes by a FRESH changeId scan at call time —
// never by stored node keys. The caller wraps calls in ONE editor.update()
// so per-change and accept/reject-all are each a single history entry and a
// single reconcile.
//
// Semantics (the SuperDoc pattern):
//   accept insert → strip the mark (text becomes plain, stays)
//   reject insert → remove the text
//   accept delete → remove the struck text
//   reject delete → strip the mark (text becomes live again)
//   accept split  → remove the marker (the paragraph split becomes permanent)
//   reject split  → remove the marker and merge the split block back into its
//                   previous sibling (structural restoration derived entirely
//                   from tree-local data — no snapshots)
import {
  $getRoot,
  $createTextNode,
  $isElementNode,
  type LexicalNode,
} from 'lexical';
import { $isTrackedTextNode, TrackedTextNode } from '../../components/TrackedTextNode';
import type { NodeOriginMapType } from '../../sync/nodeOriginMap';

/** Collect every TrackedTextNode carrying the given changeId, in document order. */
function $nodesWithChangeId(changeId: string): TrackedTextNode[] {
  const found: TrackedTextNode[] = [];
  const visit = (node: LexicalNode): void => {
    if ($isTrackedTextNode(node)) {
      if (node.getMark().changeId === changeId) found.push(node);
      return;
    }
    if ($isElementNode(node)) {
      for (const child of node.getChildren()) visit(child);
    }
  };
  for (const child of $getRoot().getChildren()) visit(child);
  return found;
}

/** Replace a mark node with a plain TextNode carrying the same text + format.
 *  ADR-015 / BUG-50: a mark over a stamped token (`<uicontrol>`) carries that
 *  stamp in the origin map; the plain node inherits it, so Reject gives the
 *  element back, not bare text. Token mode goes with the stamp. */
function $stripMark(node: TrackedTextNode, originMap?: NodeOriginMapType): void {
  const plain = $createTextNode(node.getTextContent());
  plain.setFormat(node.getFormat());
  plain.setStyle(node.getStyle());
  const origin = originMap?.get(node.getKey());
  if (origin?.inlineTag) {
    plain.setMode('token');
    originMap!.set(plain.getKey(), origin);
  }
  node.replace(plain);
}

/** Reject-split: merge the marker's block back into its previous sibling. */
function $unsplitAt(marker: TrackedTextNode): void {
  const block = marker.getParent();
  marker.remove();
  if (!block || !$isElementNode(block)) return;
  const prev = block.getPreviousSibling();
  if (!prev || !$isElementNode(prev)) return; // no previous block — split is unrecoverable, keep block
  for (const child of block.getChildren()) {
    prev.append(child);
  }
  block.remove();
}

export function $acceptChange(changeId: string, originMap?: NodeOriginMapType): void {
  for (const node of $nodesWithChangeId(changeId)) {
    const kind = node.getMark().kind;
    if (kind === 'insert') {
      $stripMark(node, originMap);
    } else {
      // delete: struck text goes away for good; split: marker removed, split stays
      node.remove();
    }
  }
}

export function $rejectChange(changeId: string, originMap?: NodeOriginMapType): void {
  for (const node of $nodesWithChangeId(changeId)) {
    const kind = node.getMark().kind;
    if (kind === 'insert') {
      node.remove();
    } else if (kind === 'delete') {
      $stripMark(node, originMap); // resurrect
    } else {
      $unsplitAt(node);
    }
  }
}

/** Collect every distinct changeId in the tree, in document order. */
function $allChangeIds(): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const visit = (node: LexicalNode): void => {
    if ($isTrackedTextNode(node)) {
      const id = node.getMark().changeId;
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
      return;
    }
    if ($isElementNode(node)) {
      for (const child of node.getChildren()) visit(child);
    }
  };
  for (const child of $getRoot().getChildren()) visit(child);
  return ids;
}

export function $acceptAllChanges(originMap?: NodeOriginMapType): void {
  for (const id of $allChangeIds()) $acceptChange(id, originMap);
}

export function $rejectAllChanges(originMap?: NodeOriginMapType): void {
  for (const id of $allChangeIds()) $rejectChange(id, originMap);
}
