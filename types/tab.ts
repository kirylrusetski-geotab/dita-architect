import type { XmlError } from '../components/MonacoDitaEditor';
import type { HerettoFile } from './heretto';

/**
 * FR-046: three document modes replace the old editMode boolean.
 *  - 'editing'    — direct edits, live XML sync (the default)
 *  - 'suggesting' — edits are recorded as tracked-change marks; XML sync suspended
 *  - 'viewing'    — the visual editor is read-only (the XML pane stays live)
 */
export type DocumentMode = 'viewing' | 'suggesting' | 'editing';

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
  documentMode: DocumentMode;
  /** Monotonic triggers: bumping one fires the corresponding SuggestionPlugin effect. */
  acceptAllTrigger: number;
  rejectAllTrigger: number;
  /** Live count of unresolved tracked changes (updated by SuggestionPlugin). */
  trackedChangeCount: number;
  herettoReplaceTarget?: { uuid: string; name?: string; path?: string } | null;
  herettoJustLoaded: boolean;
  inlineValidationErrors: Map<string, { type: 'broken-xref' | 'unresolved-keyref', message: string }>;
  validationTrigger: number;
  /**
   * FR-045: an API insertion awaiting review in the Monaco diff surface.
   * `baseXml` is the document the proposal was computed against — Accept must
   * fail if the tab has drifted from it (never commit against a moved base).
   */
  pendingReview: { proposedXml: string; baseXml: string; sourceLabel?: string } | null;
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
  documentMode: 'editing',
  acceptAllTrigger: 0,
  rejectAllTrigger: 0,
  trackedChangeCount: 0,
  herettoReplaceTarget: null,
  herettoJustLoaded: false,
  inlineValidationErrors: new Map(),
  validationTrigger: 0,
  pendingReview: null,
});
