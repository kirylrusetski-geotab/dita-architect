import { createContext, useContext } from 'react';
import type { LexicalEditor } from 'lexical';
import type { NodeOriginMapType } from './nodeOriginMap';
import type { XmlMetaCache } from './serializeLexicalToXml';

// ADR-015: components that render outside SyncManager's provider but inside
// the same LexicalComposer (ChangeListPanel) need the tab's origin map to
// keep a stamped token's element across accept/reject. SyncManager registers
// the map it owns; a WeakMap keeps the registry per editor and leak-free.
const originMaps = new WeakMap<LexicalEditor, NodeOriginMapType>();

export const registerEditorOriginMap = (editor: LexicalEditor, map: NodeOriginMapType): void => {
  originMaps.set(editor, map);
};

export const originMapForEditor = (editor: LexicalEditor): NodeOriginMapType | undefined => originMaps.get(editor);

export interface SyncContextValue {
  nodeOriginMap: NodeOriginMapType;
  xmlMetaCache: XmlMetaCache;
}

export const SyncContext = createContext<SyncContextValue | null>(null);

export const useSyncContext = (): SyncContextValue => {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error('useSyncContext must be used within a SyncContext.Provider');
  }
  return ctx;
};
