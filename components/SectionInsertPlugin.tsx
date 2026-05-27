import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot } from 'lexical';
import { parseSectionFragment, useSyncContext } from '../sync';
import { registerSectionInsertExecutor } from '../lib/native-api-bridge';

interface Props {
  tabId: string;
}

export function SectionInsertPlugin({ tabId }: Props) {
  const [editor] = useLexicalComposerContext();
  const { nodeOriginMap } = useSyncContext();

  useEffect(() => {
    registerSectionInsertExecutor((targetTabId, sectionXml) => {
      if (targetTabId !== tabId) return;

      // parseSectionFragment calls Lexical $create* functions which require an active
      // editor context — must run inside editor.update()
      editor.update(() => {
        const nodes = parseSectionFragment(sectionXml, nodeOriginMap);
        if (!nodes || nodes.length === 0) {
          console.warn('SectionInsertPlugin: parseSectionFragment returned no nodes');
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
