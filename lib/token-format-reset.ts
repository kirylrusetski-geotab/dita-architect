// BUG-39: a stamped leaf inline token (ADR-010 M1 — <uicontrol>, <wintitle>)
// carries a presentational format flag that stands in for its tag (bold for
// uicontrol, italic for wintitle; term/filepath/refless ph carry none). Lexical's
// own collapsed-selection handling copies the anchor node's format onto the
// selection whenever the caret lands on it (`updateDOMSelection` in Lexical
// core: `selection.format = anchorNode.getFormat()`), with no exception for
// token-mode nodes — so text typed right before or after a stamped token
// inherits that flag and is saved as a stray <b>/<i> the author never asked
// for, even though nothing the author typed is lost.
//
// Fix: the moment the caret lands on either boundary of a stamped token,
// clear exactly the flag the stamp itself contributes — never a format the
// author toggled on purpose for an unrelated reason elsewhere in the
// selection. Called from TokenFormatResetPlugin on every SELECTION_CHANGE_COMMAND.
import { $getSelection, $isRangeSelection, $isTextNode } from 'lexical';
import type { NodeOriginMapType } from '../sync/nodeOriginMap';

/** The one format each stamped tag's presentation stands in for (inline-units.ts). */
const STAMP_FORMAT: Record<string, 'bold' | 'italic'> = {
  uicontrol: 'bold',
  wintitle: 'italic',
};

export const $resetStampedFormatAtCaret = (originMap: NodeOriginMapType): void => {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
  const anchor = selection.anchor;
  if (anchor.type !== 'text') return;
  const node = anchor.getNode();
  if (!$isTextNode(node)) return;
  const stampFmt = STAMP_FORMAT[originMap.get(node.getKey())?.inlineTag ?? ''];
  if (!stampFmt) return;
  // Only at the token's own boundary — not every selection change involving
  // it — so a selection that merely spans past it (not reachable collapsed,
  // but kept explicit) never triggers this.
  const atBoundary = anchor.offset === 0 || anchor.offset === node.getTextContentSize();
  if (atBoundary && selection.hasFormat(stampFmt)) selection.toggleFormat(stampFmt);
};
