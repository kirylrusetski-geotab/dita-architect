// FR-066 / ADR-013 decision 9: insert a variable from the connected map at the
// caret. The reference is a chip whose element is the target's (DITA's conref
// rule), so it serializes as exactly <tag conkeyref="key/id"/> (BUG-46's refTag).
// The Toolbar's picker dispatches the command; Suggesting mode blocks it in
// SuggestionPlugin, as it blocks the inline-element wrap.
import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { createCommand, COMMAND_PRIORITY_EDITOR, $getSelection, $isRangeSelection } from 'lexical';
import { toast } from 'sonner';
import { $createDitaPhRefNode } from './DitaPhRefNode';

export interface InsertVariablePayload {
  key: string;
  id: string;
  tag: string;
}

export const INSERT_VARIABLE_COMMAND = createCommand<InsertVariablePayload>('INSERT_VARIABLE_COMMAND');

export const InsertVariablePlugin = () => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => editor.registerCommand(
    INSERT_VARIABLE_COMMAND,
    ({ key, id, tag }) => {
      if (!editor.isEditable()) return true;
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        toast('Place the cursor in the text where the variable should go');
        return true;
      }
      // A range is replaced, as typing over it would.
      selection.insertNodes([$createDitaPhRefNode('conkeyref', `${key}/${id}`, '', tag)]);
      return true;
    },
    COMMAND_PRIORITY_EDITOR,
  ), [editor]);

  return null;
};
