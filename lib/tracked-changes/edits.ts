// FR-046 — the suggesting-mode write path.
//
// Called from SuggestionPlugin's command interceptors, always inside
// editor.update(). Instead of mutating text directly, every gesture records
// itself as marks:
//   typing            → tracked-insert text (merging into an adjacent own
//                       insert run — one node, one changeId per run)
//   deleting plain    → text converted to a kept-and-struck delete mark
//   deleting own mark → the suggestion itself shrinks/disappears
//   Enter             → paragraph split + zero-width split marker
//
// All functions return a status result so the plugin can toast honestly on
// blocked operations instead of silently doing nothing.
import {
  $createRangeSelection,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isLineBreakNode,
  $isRangeSelection,
  $isTextNode,
  type ElementNode,
  type LexicalNode,
  type RangeSelection,
  type TextNode,
} from 'lexical';
import {
  $createTrackedTextNode,
  $isTrackedTextNode,
  TrackedTextNode,
} from '../../components/TrackedTextNode';
import { newMark, SESSION_AUTHOR, type TrackedMark } from './model';

export type EditResult =
  | { status: 'ok' }
  | { status: 'hopped' } // caret moved past an existing delete mark, no mutation
  | { status: 'blocked-boundary' } // block merge between original blocks — not tracked in v1
  | { status: 'blocked-decorator' } // embedded element (image, ref chip, …) — not tracked in v1
  | { status: 'reject-split'; changeId: string }; // backspace onto an own split marker

// ── caret helpers ────────────────────────────────────────────────────────────

function $selectBeforeNode(node: LexicalNode): void {
  const prev = node.getPreviousSibling();
  if (prev && $isTextNode(prev) && !$isTrackedTextNode(prev)) {
    const len = prev.getTextContentSize();
    prev.select(len, len);
    return;
  }
  const parent = node.getParentOrThrow();
  const idx = node.getIndexWithinParent();
  parent.select(idx, idx);
}

function $selectAfterNode(node: LexicalNode): void {
  const next = node.getNextSibling();
  if (next && $isTextNode(next) && !$isTrackedTextNode(next)) {
    next.select(0, 0);
    return;
  }
  const parent = node.getParentOrThrow();
  const idx = node.getIndexWithinParent();
  parent.select(idx + 1, idx + 1);
}

// ── shared node utilities ────────────────────────────────────────────────────

function isOwnInsertMark(node: LexicalNode | null | undefined): node is TrackedTextNode {
  return (
    $isTrackedTextNode(node) &&
    node.getMark().kind === 'insert' &&
    node.getMark().author === SESSION_AUTHOR
  );
}

function isDeleteMark(node: LexicalNode | null | undefined): node is TrackedTextNode {
  return $isTrackedTextNode(node) && node.getMark().kind === 'delete';
}

function isSplitMarker(node: LexicalNode | null | undefined): node is TrackedTextNode {
  return $isTrackedTextNode(node) && node.getMark().kind === 'split';
}

/** Isolate [start, end) of a text node into its own node via splitText. */
function $isolateRange(node: TextNode, start: number, end: number): TextNode {
  const len = node.getTextContentSize();
  if (start === 0 && end === len) return node;
  if (start === 0) return node.splitText(end)[0];
  if (end === len) return node.splitText(start)[1];
  return node.splitText(start, end)[1];
}

/** Convert a plain text node (or isolated part) into a delete mark, format preserved. */
function $convertToDeleteMark(part: TextNode, mark: TrackedMark): TrackedTextNode {
  const dm = $createTrackedTextNode(part.getTextContent(), mark);
  dm.setFormat(part.getFormat());
  dm.setStyle(part.getStyle());
  part.replace(dm);
  return dm;
}

/** Deepest last text descendant of an inline element (e.g. LinkNode), if any. */
function lastTextDescendant(node: LexicalNode): TextNode | null {
  if ($isTextNode(node)) return node;
  if ($isElementNode(node)) {
    for (let child = node.getLastChild(); child; child = child.getPreviousSibling()) {
      const found = lastTextDescendant(child);
      if (found) return found;
    }
  }
  return null;
}

function firstTextDescendant(node: LexicalNode): TextNode | null {
  if ($isTextNode(node)) return node;
  if ($isElementNode(node)) {
    for (let child = node.getFirstChild(); child; child = child.getNextSibling()) {
      const found = firstTextDescendant(child);
      if (found) return found;
    }
  }
  return null;
}

// ── insertion ────────────────────────────────────────────────────────────────

/**
 * Insert typed/pasted text as a tracked insertion at a collapsed selection.
 * Merge rule: adjacent own insert run absorbs the text (one node, one
 * changeId); otherwise a fresh mark node with a fresh changeId is created.
 * Pass an explicit `mark` to group multi-step gestures (paste-over-range).
 */
export function $insertTrackedText(
  selection: RangeSelection,
  text: string,
  mark?: TrackedMark,
): EditResult {
  const point = selection.anchor;

  if (point.type === 'text') {
    const node = point.getNode();
    const offset = point.offset;

    if ($isTrackedTextNode(node)) {
      const nodeMark = node.getMark();
      if (nodeMark.kind === 'insert' && nodeMark.author === SESSION_AUTHOR) {
        node.spliceText(offset, 0, text, true);
        return { status: 'ok' };
      }
      // Inside a delete mark or split marker: park the insertion after it.
      const next = node.getNextSibling();
      if (isOwnInsertMark(next)) {
        next.spliceText(0, 0, text, true);
        return { status: 'ok' };
      }
      const fresh = $createTrackedTextNode(text, mark ?? newMark('insert'));
      node.insertAfter(fresh);
      fresh.select(text.length, text.length);
      return { status: 'ok' };
    }

    // Plain text node — boundary merges first.
    if (offset === 0) {
      const prev = node.getPreviousSibling();
      if (isOwnInsertMark(prev)) {
        const len = prev.getTextContentSize();
        prev.spliceText(len, 0, text, true);
        return { status: 'ok' };
      }
    }
    const len = node.getTextContentSize();
    if (offset === len) {
      const next = node.getNextSibling();
      if (isOwnInsertMark(next)) {
        next.spliceText(0, 0, text, true);
        return { status: 'ok' };
      }
    }

    const fresh = $createTrackedTextNode(text, mark ?? newMark('insert'));
    fresh.setFormat(node.getFormat());
    fresh.setStyle(node.getStyle());
    if (offset === 0) {
      node.insertBefore(fresh);
    } else if (offset === len) {
      node.insertAfter(fresh);
    } else {
      const [left] = node.splitText(offset);
      left.insertAfter(fresh);
    }
    fresh.select(text.length, text.length);
    return { status: 'ok' };
  }

  // Element point (empty paragraph, between inline children).
  const parent = point.getNode();
  if (!$isElementNode(parent)) return { status: 'ok' };
  const idx = point.offset;
  const before = parent.getChildAtIndex(idx - 1);
  if (isOwnInsertMark(before)) {
    const len = before.getTextContentSize();
    before.spliceText(len, 0, text, true);
    return { status: 'ok' };
  }
  const at = parent.getChildAtIndex(idx);
  if (isOwnInsertMark(at)) {
    at.spliceText(0, 0, text, true);
    return { status: 'ok' };
  }
  const fresh = $createTrackedTextNode(text, mark ?? newMark('insert'));
  if (before) {
    before.insertAfter(fresh);
  } else if (at) {
    at.insertBefore(fresh);
  } else {
    parent.append(fresh);
  }
  fresh.select(text.length, text.length);
  return { status: 'ok' };
}

// ── collapsed deletion ───────────────────────────────────────────────────────

interface DeletionTarget {
  node: TextNode;
  /** character index inside node of the char to delete */
  index: number;
}

/**
 * Resolve the single character a collapsed Backspace/Delete targets, hopping
 * across siblings and into inline elements. Returns an EditResult directly
 * for the non-character outcomes (boundary, decorator, delete-mark hop,
 * split-marker reject).
 */
function $resolveCollapsedTarget(
  selection: RangeSelection,
  isBackward: boolean,
): DeletionTarget | EditResult {
  const point = selection.anchor;

  const stepFrom = (from: LexicalNode): DeletionTarget | EditResult => {
    const sibling = isBackward ? from.getPreviousSibling() : from.getNextSibling();
    if (!sibling) {
      // Block boundary. Backspace right after an own split marker at block
      // head → that split's own reject (undo your Enter).
      if (isBackward && isSplitMarker(from)) {
        return { status: 'reject-split', changeId: (from as TrackedTextNode).getMark().changeId };
      }
      return { status: 'blocked-boundary' };
    }
    if (isSplitMarker(sibling)) {
      if (isBackward) {
        return { status: 'reject-split', changeId: sibling.getMark().changeId };
      }
      return stepFrom(sibling);
    }
    if (isDeleteMark(sibling)) {
      // Hop the caret over already-struck text.
      if (isBackward) $selectBeforeNode(sibling);
      else $selectAfterNode(sibling);
      return { status: 'hopped' };
    }
    if ($isDecoratorNode(sibling) || $isLineBreakNode(sibling)) {
      return { status: 'blocked-decorator' };
    }
    if ($isTextNode(sibling)) {
      const len = sibling.getTextContentSize();
      if (len === 0) return stepFrom(sibling);
      return { node: sibling, index: isBackward ? len - 1 : 0 };
    }
    if ($isElementNode(sibling)) {
      // Inline element (LinkNode) — descend to its edge text.
      const inner = isBackward ? lastTextDescendant(sibling) : firstTextDescendant(sibling);
      if (!inner) return { status: 'blocked-decorator' };
      const len = inner.getTextContentSize();
      if (len === 0) return { status: 'blocked-decorator' };
      return { node: inner, index: isBackward ? len - 1 : 0 };
    }
    return { status: 'blocked-decorator' };
  };

  if (point.type === 'text') {
    const node = point.getNode();
    const offset = point.offset;
    if (isBackward) {
      if (offset > 0) return { node, index: offset - 1 };
      return stepFrom(node);
    }
    if (offset < node.getTextContentSize()) return { node, index: offset };
    return stepFrom(node);
  }

  // Element point: the "sibling" is the child at the point's index.
  const parent = point.getNode();
  if (!$isElementNode(parent)) return { status: 'blocked-boundary' };
  const child = parent.getChildAtIndex(isBackward ? point.offset - 1 : point.offset);
  if (!child) return { status: 'blocked-boundary' };
  // Reuse stepFrom's classification by faking a step from a virtual position:
  if (isSplitMarker(child)) {
    if (isBackward) return { status: 'reject-split', changeId: child.getMark().changeId };
    return { status: 'blocked-boundary' };
  }
  if (isDeleteMark(child)) {
    if (isBackward) $selectBeforeNode(child);
    else $selectAfterNode(child);
    return { status: 'hopped' };
  }
  if ($isDecoratorNode(child) || $isLineBreakNode(child)) return { status: 'blocked-decorator' };
  if ($isTextNode(child)) {
    const len = child.getTextContentSize();
    if (len === 0) return { status: 'blocked-boundary' };
    return { node: child, index: isBackward ? len - 1 : 0 };
  }
  if ($isElementNode(child)) {
    const inner = isBackward ? lastTextDescendant(child) : firstTextDescendant(child);
    if (!inner || inner.getTextContentSize() === 0) return { status: 'blocked-decorator' };
    return { node: inner, index: isBackward ? inner.getTextContentSize() - 1 : 0 };
  }
  return { status: 'blocked-decorator' };
}

/**
 * Collapsed Backspace/Delete in suggesting mode.
 *  - own insert mark  → the suggestion itself shrinks (real deletion)
 *  - plain text       → 1 char becomes a delete mark, merging into an
 *                       adjacent same-author delete run (one changeId)
 *  - delete mark      → caret hops over it
 */
export function $markCollapsedDeletion(
  selection: RangeSelection,
  isBackward: boolean,
): EditResult {
  const resolved = $resolveCollapsedTarget(selection, isBackward);
  if (!('node' in resolved)) return resolved;

  const { node, index } = resolved;

  if ($isTrackedTextNode(node)) {
    const mark = node.getMark();
    if (mark.kind === 'insert' && mark.author === SESSION_AUTHOR) {
      node.spliceText(index, 1, '', true);
      if (node.getTextContentSize() === 0) {
        const parent = node.getParentOrThrow();
        const idx = node.getIndexWithinParent();
        node.remove();
        parent.select(idx, idx);
      }
      return { status: 'ok' };
    }
    // delete marks / split markers are handled by $resolveCollapsedTarget
    if (isBackward) $selectBeforeNode(node);
    else $selectAfterNode(node);
    return { status: 'hopped' };
  }

  // Plain text: isolate the char and convert to a delete mark.
  const char = $isolateRange(node, index, index + 1);

  // Merge into an adjacent same-author delete run before creating a new one.
  const mergeTarget = isBackward ? char.getNextSibling() : char.getPreviousSibling();
  if (isDeleteMark(mergeTarget) && mergeTarget.getMark().author === SESSION_AUTHOR) {
    if (isBackward) {
      mergeTarget.spliceText(0, 0, char.getTextContent(), false);
    } else {
      mergeTarget.spliceText(mergeTarget.getTextContentSize(), 0, char.getTextContent(), false);
    }
    char.remove();
    if (isBackward) $selectBeforeNode(mergeTarget);
    else $selectAfterNode(mergeTarget);
    return { status: 'ok' };
  }

  const dm = $convertToDeleteMark(char, newMark('delete'));
  if (isBackward) $selectBeforeNode(dm);
  else $selectAfterNode(dm);
  return { status: 'ok' };
}

// ── range deletion ───────────────────────────────────────────────────────────

/**
 * Mark an entire (non-collapsed) selection as deleted — one changeId for the
 * whole gesture. Own insert segments are truly removed (retracting your own
 * suggestion); existing delete marks are left as-is; decorators are skipped
 * (reported via sawDecorator so the plugin can toast once).
 */
export function $markRangeAsDeleted(
  selection: RangeSelection,
  mark?: TrackedMark,
): { result: EditResult; gestureMark: TrackedMark; sawDecorator: boolean; lastMarkNode: TrackedTextNode | null } {
  const gestureMark = mark ?? newMark('delete');
  let sawDecorator = false;
  let lastMarkNode: TrackedTextNode | null = null;

  const isBackward = selection.isBackward();
  const startPoint = isBackward ? selection.focus : selection.anchor;
  const endPoint = isBackward ? selection.anchor : selection.focus;
  const startKey = startPoint.key;
  const endKey = endPoint.key;

  const nodes = selection.getNodes();

  for (const node of nodes) {
    if ($isElementNode(node)) continue; // children arrive separately
    if ($isDecoratorNode(node) || $isLineBreakNode(node)) {
      sawDecorator = true;
      continue;
    }
    if (!$isTextNode(node)) continue;

    const len = node.getTextContentSize();
    const start =
      node.getKey() === startKey && startPoint.type === 'text' ? startPoint.offset : 0;
    const end = node.getKey() === endKey && endPoint.type === 'text' ? endPoint.offset : len;
    if (start >= end) continue;

    if ($isTrackedTextNode(node)) {
      const nodeMark = node.getMark();
      if (nodeMark.kind === 'delete') continue; // already struck
      if (nodeMark.kind === 'split') continue; // markers untouched by range deletes
      if (nodeMark.kind === 'insert' && nodeMark.author === SESSION_AUTHOR) {
        // Retract (part of) your own suggestion — real removal.
        const part = $isolateRange(node, start, end);
        part.remove();
        continue;
      }
      continue;
    }

    const part = $isolateRange(node, start, end);
    lastMarkNode = $convertToDeleteMark(part, gestureMark);
  }

  if (lastMarkNode) {
    $selectAfterNode(lastMarkNode);
  } else {
    // Nothing became a mark (selection was all own-inserts / already struck):
    // collapse to the start point's best-effort position.
    const sel = $getSelection();
    if ($isRangeSelection(sel) && !sel.isCollapsed()) {
      const collapsed = $createRangeSelection();
      collapsed.anchor.set(sel.anchor.key, sel.anchor.offset, sel.anchor.type);
      collapsed.focus.set(sel.anchor.key, sel.anchor.offset, sel.anchor.type);
    }
  }

  return { result: { status: 'ok' }, gestureMark, sawDecorator, lastMarkNode };
}

// ── paragraph split ──────────────────────────────────────────────────────────

/**
 * Enter in suggesting mode: perform the real split, then record it by
 * prepending a zero-width split marker at the head of the new block.
 * Reject = merge back (mutations.$unsplitAt); accept = drop the marker.
 */
export function $trackedParagraphSplit(selection: RangeSelection): EditResult {
  selection.insertParagraph();

  const after = $getSelection();
  if (!$isRangeSelection(after)) return { status: 'ok' };

  const anchorNode = after.anchor.getNode();
  const block: ElementNode | null = $isElementNode(anchorNode)
    ? anchorNode
    : anchorNode.getParent();
  if (!block) return { status: 'ok' };

  const marker = $createTrackedTextNode('', newMark('split'));
  const first = block.getFirstChild();
  if (first) {
    first.insertBefore(marker);
  } else {
    block.append(marker);
  }
  // Caret after the marker (element point index 1).
  block.select(1, 1);
  return { status: 'ok' };
}
