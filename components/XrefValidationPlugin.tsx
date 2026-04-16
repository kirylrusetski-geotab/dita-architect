import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey } from 'lexical';
import { LinkNode, $isLinkNode } from '@lexical/link';

const BROKEN_XREF_CLASS = 'dita-xref-broken';

/**
 * P2-6 MVP: Flags xref links with empty or missing href attributes
 * in the visual editor using a red wavy underline.
 */
export const XrefValidationPlugin = () => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const removeMutationListener = editor.registerMutationListener(
      LinkNode,
      (mutatedNodes) => {
        editor.getEditorState().read(() => {
          for (const [nodeKey, mutation] of mutatedNodes) {
            if (mutation === 'destroyed') continue;

            const node = $getNodeByKey(nodeKey);
            if (!node || !$isLinkNode(node)) continue;

            const url = node.getURL();
            const domElement = editor.getElementByKey(nodeKey);
            if (!domElement) continue;

            if (!url || !url.trim()) {
              domElement.classList.add(BROKEN_XREF_CLASS);
            } else {
              domElement.classList.remove(BROKEN_XREF_CLASS);
            }
          }
        });
      },
    );

    return () => {
      removeMutationListener();
    };
  }, [editor]);

  return null;
};
