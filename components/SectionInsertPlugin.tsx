import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey, $getRoot } from 'lexical';
import { parseSectionFragment, useSyncContext } from '../sync';
import { findLexicalKeyByXmlId } from '../sync/parseXmlToLexical';
import { registerSectionInsertExecutor } from '../lib/native-api-bridge';

interface Props {
  tabId: string;
}

export function SectionInsertPlugin({ tabId }: Props) {
  const [editor] = useLexicalComposerContext();
  const { nodeOriginMap } = useSyncContext();

  useEffect(() => {
    registerSectionInsertExecutor((targetTabId, sectionXml, options) => {
      if (targetTabId !== tabId) return;

      // parseSectionFragment calls Lexical $create* functions which require an active
      // editor context — must run inside editor.update()
      editor.update(() => {
        const nodes = parseSectionFragment(sectionXml, nodeOriginMap);
        if (!nodes || nodes.length === 0) {
          console.warn('SectionInsertPlugin: parseSectionFragment returned no nodes');
          return;
        }

        if (options?.replaceId) {
          const targetKey = findLexicalKeyByXmlId(nodeOriginMap, options.replaceId);
          if (!targetKey) {
            console.warn(`SectionInsertPlugin: replaceId "${options.replaceId}" not found; appending instead`);
            const root = $getRoot();
            for (const node of nodes) root.append(node);
            return;
          }
          const target = $getNodeByKey(targetKey);
          if (!target) {
            console.warn(`SectionInsertPlugin: node for key "${targetKey}" missing; appending instead`);
            const root = $getRoot();
            for (const node of nodes) root.append(node);
            return;
          }
          // Insert new nodes immediately before the replaced node, then remove
          // the original. The removed block disappears from the current state
          // while remaining in the EditModePlugin baseline snapshot, so
          // Reject restores it; Accept finalizes the replacement.
          let cursor: any = target;
          for (let i = nodes.length - 1; i >= 0; i--) {
            cursor.insertBefore(nodes[i]);
            cursor = nodes[i];
          }
          target.remove();
          return;
        }

        const root = $getRoot();
        for (const node of nodes) {
          root.append(node);
        }
      });
    });
    // registerSectionInsertExecutor replaces the global slot — safe to run once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  return null;
}
