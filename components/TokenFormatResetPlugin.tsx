// BUG-39: see lib/token-format-reset.ts for the mechanism. Mounted inside
// SyncManager because it reads originMap (useSyncContext), the same reason
// InsertElementPlugin and InlineWrapPlugin live there.
import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_EDITOR } from 'lexical';
import { useSyncContext } from '../sync';
import { $resetStampedFormatAtCaret } from '../lib/token-format-reset';

export const TokenFormatResetPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const { nodeOriginMap } = useSyncContext();

  useEffect(() => editor.registerCommand(
    SELECTION_CHANGE_COMMAND,
    () => {
      $resetStampedFormatAtCaret(nodeOriginMap);
      return false; // never swallow — other selection-change listeners still run
    },
    COMMAND_PRIORITY_EDITOR,
  ), [editor, nodeOriginMap]);

  return null;
};
