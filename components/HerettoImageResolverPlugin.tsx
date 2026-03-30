import React, { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $getNodeByKey, LexicalNode } from 'lexical';
import { DitaImageNode, $isDitaImageNode } from './DitaImageNode';
import { resolveHerettoImageHref } from '../lib/heretto-image-resolver';
import type { HerettoFile } from '../types/heretto';

interface HerettoImageResolverPluginProps {
  herettoFile: HerettoFile | null;
  syncTrigger: number;
}

/**
 * Lexical plugin that resolves relative DITA image hrefs to Heretto content URLs
 */
export function HerettoImageResolverPlugin({ herettoFile, syncTrigger }: HerettoImageResolverPluginProps): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Early return if no herettoFile or missing required fields
    if (!herettoFile || !herettoFile.parentFolderUuid || !herettoFile.ancestorUuids) {
      return;
    }

    const resolveImages = () => {
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const nodeQueue: string[] = [];

        // Traverse all nodes to find DitaImageNode instances
        function traverse(node: LexicalNode): void {
          if ($isDitaImageNode(node)) {
            const href = node.__href;
            const isUrl = /^https?:\/\//.test(href);
            const hasResolvedUrl = node.getResolvedUrl() !== null;

            // Only resolve relative hrefs that haven't been resolved yet
            if (!isUrl && !hasResolvedUrl) {
              nodeQueue.push(node.__key);
            }
          }

          // Only traverse children if the node supports getChildren
          if ('getChildren' in node && typeof node.getChildren === 'function') {
            const children = node.getChildren();
            for (const child of children) {
              traverse(child);
            }
          }
        }

        traverse(root);

        // Resolve each image asynchronously
        nodeQueue.forEach(async (key) => {
          try {
            const currentNode = editor.getEditorState().read(() => $getNodeByKey(key));

            if (!currentNode || !$isDitaImageNode(currentNode)) {
              return; // Node was deleted or changed type
            }

            const href = currentNode.__href;
            const resolvedUrl = await resolveHerettoImageHref(
              href,
              herettoFile.parentFolderUuid,
              herettoFile.ancestorUuids
            );

            // Update the node with the resolved URL (or empty string for failure)
            editor.update(() => {
              const node = $getNodeByKey(key);
              if (node && $isDitaImageNode(node)) {
                node.setResolvedUrl(resolvedUrl || ''); // Use empty string to indicate resolution attempt completed
              }
            });
          } catch (error) {
            console.warn('Failed to resolve image href:', error);
            // Mark as failed by setting empty string
            editor.update(() => {
              const node = $getNodeByKey(key);
              if (node && $isDitaImageNode(node)) {
                node.setResolvedUrl('');
              }
            });
          }
        });
      });
    };

    resolveImages();
  }, [editor, herettoFile, syncTrigger]);

  return null;
}
