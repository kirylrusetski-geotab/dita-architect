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
      console.warn('[HerettoImageResolver] Plugin run skipped - missing required data:', {
        hasHerettoFile: !!herettoFile,
        hasParentFolderUuid: !!herettoFile?.parentFolderUuid,
        hasAncestorUuids: !!herettoFile?.ancestorUuids,
      });
      return;
    }

    console.log('[HerettoImageResolver] Plugin running with herettoFile:', {
      name: herettoFile.name,
      uuid: herettoFile.uuid,
      path: herettoFile.path,
      parentFolderUuid: herettoFile.parentFolderUuid,
      ancestorUuidsCount: herettoFile.ancestorUuids.length,
      ancestorUuids: herettoFile.ancestorUuids,
      fullHerettoFile: herettoFile,
    });

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
            const resolvedUrl = node.getResolvedUrl();

            console.log('[HerettoImageResolver] Found image node:', {
              nodeKey: node.__key,
              href,
              isUrl,
              hasResolvedUrl,
              resolvedUrl,
              needsResolution: !isUrl && !hasResolvedUrl,
            });

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

        console.log('[HerettoImageResolver] Found', nodeQueue.length, 'images needing resolution');

        // Resolve each image asynchronously
        nodeQueue.forEach(async (key) => {
          let href = ''; // Declare href in outer scope for catch block access

          try {
            const currentNode = editor.getEditorState().read(() => $getNodeByKey(key));

            if (!currentNode || !$isDitaImageNode(currentNode)) {
              console.warn(`[HerettoImageResolver] Node with key ${key} was deleted or type changed during async resolution`);
              return; // Node was deleted or changed type
            }

            href = currentNode.__href;
            console.log('[HerettoImageResolver] Resolving image:', {
              nodeKey: key,
              href,
              parentFolderUuid: herettoFile.parentFolderUuid,
              ancestorUuidsCount: herettoFile.ancestorUuids?.length ?? 0,
            });

            const resolvedUrl = await resolveHerettoImageHref(
              href,
              herettoFile.parentFolderUuid,
              herettoFile.ancestorUuids
            );

            console.log('[HerettoImageResolver] Resolution result:', {
              nodeKey: key,
              href,
              resolvedUrl,
              success: !!resolvedUrl,
            });

            // Update the node with the resolved URL (or empty string for failure)
            editor.update(() => {
              const node = $getNodeByKey(key);
              if (node && $isDitaImageNode(node)) {
                node.setResolvedUrl(resolvedUrl || ''); // Use empty string to indicate resolution attempt completed
                console.log('[HerettoImageResolver] Node updated:', {
                  nodeKey: key,
                  finalResolvedUrl: resolvedUrl || '',
                });
              }
            });
          } catch (error) {
            console.warn('[HerettoImageResolver] Failed to resolve image href:', {
              nodeKey: key,
              href,
              parentFolderUuid: herettoFile.parentFolderUuid,
              ancestorUuidsCount: herettoFile.ancestorUuids?.length ?? 0,
              ancestorUuids: herettoFile.ancestorUuids,
              error: error instanceof Error ? error.message : error,
              fullError: error,
            });
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
