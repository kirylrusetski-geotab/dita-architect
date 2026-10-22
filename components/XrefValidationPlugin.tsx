import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey } from 'lexical';
import { LinkNode, $isLinkNode } from '@lexical/link';
import { useSyncContext } from '../sync';
import { REF_ATTRS } from '../lib/xref-validation';

const BROKEN_XREF_CLASS = 'dita-xref-broken';

// BUG-38: a keyref/conkeyref/conref <xref> is valid DITA with no href — the
// key resolves it — and common in real Heretto content. The parser's scanner
// (inline-units.ts) keeps any such attribute in originMap.inlineAttrs (every
// attribute but href), so a key-referenced link is told apart from a
// genuinely broken one by its presence there, not by the URL alone.

/**
 * P2-6 MVP: Flags xref links with empty or missing href attributes
 * in the visual editor using a red wavy underline. Mounted inside SyncManager
 * for originMap access (useSyncContext), like InlineWrapPlugin.
 */
export const XrefValidationPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const { nodeOriginMap } = useSyncContext();

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

            const inlineAttrs = nodeOriginMap.get(nodeKey)?.inlineAttrs;
            const isKeyReferenced = inlineAttrs != null && REF_ATTRS.some(a => a in inlineAttrs);

            if (!isKeyReferenced && (!url || !url.trim())) {
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
  }, [editor, nodeOriginMap]);

  return null;
};
