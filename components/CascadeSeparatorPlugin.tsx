// BUG-43: a <menucascade>'s steps render with no visual separator ("File"
// immediately followed by "Save" reads as "FileSave"). originMap stamps each
// step with cascadeStep (ADR-010's scanner already knows the owner —
// inline-units.ts) at parse; this plugin applies a CSS class to each such
// step's DOM element, and an adjacent-sibling CSS rule (index.css) draws a
// separator between two consecutive steps — never as document text, so it
// cannot reach the XML or the reconciler. Mounted inside SyncManager for
// originMap access (useSyncContext), like InlineWrapPlugin.
import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { TextNode } from 'lexical';
import { useSyncContext } from '../sync';

const CASCADE_STEP_CLASS = 'dita-editor-cascade-step';

export const CascadeSeparatorPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const { nodeOriginMap } = useSyncContext();

  useEffect(() => editor.registerMutationListener(
    TextNode,
    (mutatedNodes) => {
      editor.getEditorState().read(() => {
        for (const [nodeKey, mutation] of mutatedNodes) {
          if (mutation === 'destroyed') continue;
          const domElement = editor.getElementByKey(nodeKey);
          if (!domElement) continue;
          if (nodeOriginMap.get(nodeKey)?.cascadeStep) {
            domElement.classList.add(CASCADE_STEP_CLASS);
          } else {
            domElement.classList.remove(CASCADE_STEP_CLASS);
          }
        }
      });
    },
  ), [editor, nodeOriginMap]);

  return null;
};
