// ADR-010 slice B (v0.10.0): wrap the selection in a DITA inline element, or
// remove the inline element at the caret.
//
// Mounted inside SyncManager because a wrap stamps originMap (useSyncContext),
// the same reason InsertElementPlugin lives there; the Toolbar renders outside
// the provider and dispatches these commands instead. Suggesting mode blocks
// both commands in SuggestionPlugin (inline-tag changes are not tracked marks
// yet, FR-051), exactly as it blocks FORMAT_TEXT_COMMAND.
import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { createCommand, COMMAND_PRIORITY_EDITOR, COMMAND_PRIORITY_HIGH, KEY_DOWN_COMMAND, $getSelection, $isRangeSelection, type LexicalNode } from 'lexical';
import { $isLinkNode, $toggleLink } from '@lexical/link';
import { mergeRegister } from '@lexical/utils';
import { toast } from 'sonner';
import { useSyncContext } from '../sync';
import {
  $wrapSelectionInInlineTag,
  $unwrapInlineAtSelection,
  WRAP_REFUSAL_MESSAGES,
  type WrapTag,
  type XrefAttrs,
} from '../lib/inline-wrap';

export const WRAP_INLINE_COMMAND = createCommand<{ tag: WrapTag; attrs?: XrefAttrs }>('WRAP_INLINE_COMMAND');
export const UNWRAP_INLINE_COMMAND = createCommand<void>('UNWRAP_INLINE_COMMAND');

/** ⌘⇧U / Ctrl+Shift+U → <uicontrol>, ⌘⇧C / Ctrl+Shift+C → <codeph>. The rest
 *  are in the toolbar's Inline element menu. Mirrored in constants/keyboard-shortcuts.ts. */
export const WRAP_SHORTCUTS: Record<string, WrapTag> = { u: 'uicontrol', c: 'codeph' };

/** True when the selection's anchor or focus sits inside an existing link. */
const $selectionInLink = (): boolean => {
  const sel = $getSelection();
  if (!$isRangeSelection(sel)) return false;
  const inLink = (n: LexicalNode) => $isLinkNode(n) || $isLinkNode(n.getParent());
  return inLink(sel.anchor.getNode()) || inLink(sel.focus.getNode());
};

const lastToastAt = new Map<string, number>();
const toastThrottled = (message: string): void => {
  const now = Date.now();
  if (now - (lastToastAt.get(message) ?? 0) < 4000) return;
  lastToastAt.set(message, now);
  toast(message);
};

export const InlineWrapPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const { nodeOriginMap } = useSyncContext();

  useEffect(() => mergeRegister(
    editor.registerCommand(
      WRAP_INLINE_COMMAND,
      ({ tag, attrs }) => {
        if (!editor.isEditable()) return true;
        // Insert Link inside an existing link retargets it (the pre-v0.10.0
        // behaviour). Its format/scope are left as they are: changing them
        // would mean editing an existing key's originMap entry, which undo
        // could not restore (ADR-010 decision 7).
        if (tag === 'xref' && attrs?.href && $selectionInLink()) {
          $toggleLink(attrs.href.trim());
          return true;
        }
        const result = $wrapSelectionInInlineTag(tag, nodeOriginMap, attrs);
        if (result.status === 'refused') toastThrottled(WRAP_REFUSAL_MESSAGES[result.reason]);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      UNWRAP_INLINE_COMMAND,
      () => {
        if (!editor.isEditable()) return true;
        const result = $unwrapInlineAtSelection(nodeOriginMap);
        if (result.status === 'refused') toastThrottled(WRAP_REFUSAL_MESSAGES[result.reason]);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    // HIGH, not EDITOR: Lexical's own ⌘U (underline) check ignores Shift, so
    // ⌘⇧U must be claimed here first; KEY_DOWN_COMMAND runs before it.
    editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        if (!event.shiftKey || event.altKey || !(event.metaKey || event.ctrlKey)) return false;
        const tag = WRAP_SHORTCUTS[event.key.toLowerCase()];
        if (!tag) return false;
        event.preventDefault();
        editor.dispatchCommand(WRAP_INLINE_COMMAND, { tag });
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    ),
  ), [editor, nodeOriginMap]);

  return null;
};
