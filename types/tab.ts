import type { EditorState } from 'lexical';
import type { XmlError } from '../components/MonacoDitaEditor';
import type { HerettoFile } from './heretto';

export interface Tab {
  id: string;
  xmlContent: string;
  lastUpdatedBy: 'editor' | 'code' | 'api';
  savedXmlRef: { current: string };
  herettoFile: HerettoFile | null;
  herettoLastSaved: Date | null;
  herettoRemoteChanged: boolean;
  herettoDirty: boolean;
  hasXmlErrors: boolean;
  xmlErrors: XmlError[];
  syncTrigger: number;
  monacoApiRef: { current: { revealLine: (line: number, col?: number) => void } | null };
  localFileName: string | null;
  editMode: boolean;
  editModeEnterTrigger: number;
  editModeAcceptTrigger: number;
  editModeRejectTrigger: number;
  snapshotRef: { current: EditorState | null };
  herettoReplaceTarget?: { uuid: string; name?: string; path?: string } | null;
  herettoJustLoaded: boolean;
  inlineValidationErrors: Map<string, { type: 'broken-xref' | 'unresolved-keyref', message: string }>;
  validationTrigger: number;
}

let tabIdCounter = 0;

/** Resets the internal tab ID counter. Intended for use in tests only. */
export const resetTabIdCounter = (): void => { tabIdCounter = 0; };

export const createTab = (xml: string): Tab => ({
  id: `tab-${++tabIdCounter}`,
  xmlContent: xml,
  lastUpdatedBy: 'code',
  savedXmlRef: { current: xml },
  herettoFile: null,
  herettoLastSaved: null,
  herettoRemoteChanged: false,
  herettoDirty: false,
  hasXmlErrors: false,
  xmlErrors: [],
  syncTrigger: 0,
  monacoApiRef: { current: null },
  localFileName: null,
  editMode: false,
  editModeEnterTrigger: 0,
  editModeAcceptTrigger: 0,
  editModeRejectTrigger: 0,
  snapshotRef: { current: null },
  herettoReplaceTarget: null,
  herettoJustLoaded: false,
  inlineValidationErrors: new Map(),
  validationTrigger: 0,
});
