import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { ClearEditorPlugin } from '@lexical/react/LexicalClearEditorPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { createCommand } from 'lexical';
import { $createTableNode, $createTableRowNode, $createTableCellNode, TableCellHeaderStates } from '@lexical/table';
import { $getSelection, $isRangeSelection, $createParagraphNode, COMMAND_PRIORITY_EDITOR } from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { Toolbar } from './components/Toolbar';
import { BottomToolbar } from './components/BottomToolbar';
import { SyncManager } from './components/SyncManager';
import { TableColumnSizer } from './components/TableColumnSizer';
import { TableActionMenuPlugin } from './components/TableActionMenuPlugin';
import { SuggestionPlugin } from './components/SuggestionPlugin';
import { ChangeListPanel } from './components/ChangeListPanel';
import { EmptyToH1Plugin } from './components/EmptyToH1Plugin';
import { ShortdescPlugin } from './components/ShortdescPlugin';
import { InsertElementPlugin } from './components/InsertElementPlugin';
import { InlineWrapPlugin } from './components/InlineWrapPlugin';
import { InsertVariablePlugin } from './components/InsertVariablePlugin';
import { TokenFormatResetPlugin } from './components/TokenFormatResetPlugin';
import { CascadeSeparatorPlugin } from './components/CascadeSeparatorPlugin';
import { HerettoImageResolverPlugin } from './components/HerettoImageResolverPlugin';
import { XrefValidationPlugin } from './components/XrefValidationPlugin';
import { InlineValidationPlugin } from './components/InlineValidationPlugin';
import { FolderOpen, RefreshCw, CloudUpload, Loader2, X } from 'lucide-react';
import { ConfirmModal } from './components/ConfirmModal';
import { TopicTypeModal } from './components/TopicTypeModal';
import { SaveTopicModal } from './components/SaveTopicModal';
import { HerettoStatusModal } from './components/HerettoStatusModal';
import { HerettoBrowserModal } from './components/HerettoBrowserModal';
import { ReleaseNotesModal } from './components/ReleaseNotesModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { CoachMark } from './components/CoachMark';
import { APP_VERSION } from './constants/version';
import { ImportVerificationModal } from './components/ImportVerificationModal';
import { HerettoReplaceModal } from './components/HerettoReplaceModal';
import { HerettoReplaceBar } from './components/HerettoReplaceBar';
import { ExitEditModeModal } from './components/ExitEditModeModal';
import { formatRelativeTime, formatXml } from './lib/xml-utils';
import { generatePrintHtml, derivePrintTitle } from './lib/dita-print';
import { registerNativeApiBridge } from './lib/native-api-bridge';
import { registerNativeMenuBridge } from './lib/native-menu-bridge';
import { postNativePrint } from './lib/native-print';
import { pushNativeUiState } from './lib/native-ui-state';
import { useEditorUi } from './hooks/useEditorUi';
import { useTabManager } from './hooks/useTabManager';
import { createTab, type DocumentMode } from './types/tab';
import { useLocalFile } from './hooks/useLocalFile';
import { useHerettoCms } from './hooks/useHerettoCms';
import { useKeyRegistry } from './hooks/useKeyRegistry';
import { KeyRegistryContext } from './components/KeyRegistryContext';
import { ConnectMapModal } from './components/ConnectMapModal';
import { ContentModelViolationModal } from './components/ContentModelViolationModal';
import { useExternalLoad } from './hooks/useExternalLoad';
import { EDITOR_NODES } from './constants/editor-nodes';
// ADR-017: the workbench
import { useWorkbenchLayout } from './hooks/useWorkbenchLayout';
import { TitleBar } from './components/workbench/TitleBar';
import { ActivityBar } from './components/workbench/ActivityBar';
import { SidePanel } from './components/workbench/SidePanel';
import { ExplorerView } from './components/workbench/views/ExplorerView';
import { PlaceholderView } from './components/workbench/views/PlaceholderView';
import { SearchView } from './components/workbench/views/SearchView';
import { MapView } from './components/workbench/views/MapView';
import { openableItem } from './lib/heretto-ancestry';
import { clearHerettoPathCache } from './lib/heretto-path';
import { isDitamapName } from './lib/heretto-utils';
import type { HerettoSearchResult } from './types/heretto';
import type { SearchHit } from './lib/heretto-search';
import { RightRail } from './components/workbench/RightRail';
import { PanelColumn } from './components/workbench/PanelColumn';
import { XmlSplit } from './components/workbench/XmlSplit';

// --- LEXICAL CONFIGURATION ---

const theme = {
  heading: {
    h1: 'dita-editor-h1',
    h2: 'dita-editor-h2',
  },
  paragraph: 'dita-editor-paragraph',
  quote: 'dita-editor-quote',
  list: {
    ol: 'dita-editor-list-ol',
    ul: 'dita-editor-list-ul',
    listitem: 'dita-editor-listitem',
  },
  text: {
    bold: 'dita-editor-text-bold',
    italic: 'dita-editor-text-italic',
    underline: 'dita-editor-text-underline',
    code: 'dita-editor-code',
    strikethrough: 'dita-editor-text-strikethrough',
  },
  link: 'dita-editor-text-link',
  table: 'dita-editor-table',
  tableRow: 'dita-editor-table-row',
  tableCell: 'dita-editor-table-cell',
  tableCellHeader: 'dita-editor-table-cell-header',
};

const editorConfig = {
  namespace: 'DitaEditor',
  theme,
  onError(error: Error) {
    console.error(error);
  },
  nodes: EDITOR_NODES,
};

// Custom table insertion command
export const INSERT_TABLE_COMMAND = createCommand<{ rows: number; columns: number; includeHeaders: boolean }>('INSERT_TABLE_COMMAND');

// Commands so the InsertElementPlugin can open the Toolbar's existing modals
export const OPEN_INSERT_TABLE_MODAL_COMMAND = createCommand<void>('OPEN_INSERT_TABLE_MODAL_COMMAND');
export const OPEN_INSERT_LINK_MODAL_COMMAND = createCommand<void>('OPEN_INSERT_LINK_MODAL_COMMAND');

// Table insertion plugin
function TableInsertPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      INSERT_TABLE_COMMAND,
      (payload: { rows: number; columns: number; includeHeaders: boolean }) => {
        const { rows, columns, includeHeaders } = payload;

        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            // Create table
            const table = $createTableNode();

            // Create rows
            for (let i = 0; i < rows; i++) {
              const row = $createTableRowNode();

              // Create cells for each column
              for (let j = 0; j < columns; j++) {
                const headerState = (i === 0 && includeHeaders) ? TableCellHeaderStates.ROW : 0;
                const cell = $createTableCellNode(headerState);
                const paragraph = $createParagraphNode();
                cell.append(paragraph);
                row.append(cell);
              }

              table.append(row);
            }

            // Insert the table
            if (selection.anchor.getNode() === selection.focus.getNode()) {
              selection.anchor.getNode().insertAfter(table);
            } else {
              selection.insertNodes([table]);
            }
          }
        });

        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  return null;
}

const HerettoLogo = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <rect x="2" y="2" width="20" height="20" rx="4" fill="currentColor" opacity="0.15" />
    <text x="12" y="17.5" textAnchor="middle" fill="currentColor" fontWeight="800" fontSize="16" fontFamily="Inter, sans-serif">H</text>
  </svg>
);

// --- MAIN COMPONENT ---

export default function ProfessionalDitaEditor() {
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isNewTopicModalOpen, setIsNewTopicModalOpen] = useState(false);
  const [isReleaseNotesOpen, setIsReleaseNotesOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [exitSuggestingConfirm, setExitSuggestingConfirm] = useState<{ tabId: string; targetMode: DocumentMode } | null>(null);
  const [isHerettoReplaceModalOpen, setIsHerettoReplaceModalOpen] = useState(false);

  const [wordWrapEnabled, setWordWrapEnabled] = useState<boolean>(() =>
    localStorage.getItem('ditaWordWrap') === 'true'
  );
  const toggleWordWrap = useCallback(() => {
    setWordWrapEnabled(prev => {
      const next = !prev;
      localStorage.setItem('ditaWordWrap', String(next));
      return next;
    });
  }, []);

  // ADR-017: the editor-plus-XML container; the XML split's drag is measured against it.
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // Show "What's New" on first launch after a version update
  useEffect(() => {
    const lastSeenVersion = localStorage.getItem('dita-architect-last-seen-version');
    if (lastSeenVersion !== APP_VERSION) {
      setIsReleaseNotesOpen(true);
      localStorage.setItem('dita-architect-last-seen-version', APP_VERSION);
    }
  }, []);

  const {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    activeTab,
    updateTab,
    currentTopicType,
    handleCloseTab,
    handleNewTab,
    handleNewTopic,
    handleConvertTopic,
  } = useTabManager({
    setIsConvertModalOpen,
    setIsNewTopicModalOpen,
    setConfirmModal,
  });

  const {
    isHerettoStatusOpen,
    setIsHerettoStatusOpen,
    herettoCredentials,
    setHerettoCredentials,
    herettoStatusChecking,
    isHerettoBrowserOpen,
    setIsHerettoBrowserOpen,
    herettoBrowserMode,
    herettoConnected,
    herettoBrowsing,
    herettoBreadcrumbs,
    setHerettoBreadcrumbs,
    herettoItems,
    herettoSelected,
    setHerettoSelected,
    herettoSaving,
    herettoSaveProgress,
    contentModelViolations,
    setContentModelViolations,
    herettoSaveFileName,
    setHerettoSaveFileName,
    herettoRefreshing,
    herettoSearchResults,
    herettoSearchStatus,
    herettoSearchAbortRef,
    importVerification,
    setImportVerification,
    openHerettoStatus,
    testHerettoConnection,
    saveHerettoCredentials,
    herettoNavigate,
    herettoSearch,
    openHerettoBrowser,
    handleHerettoOpen,
    handleImportContinue,
    handleHerettoSave,
    handleHerettoRefresh,
    handleHerettoDisconnect,
    handleHerettoSaveNew,
    handleHerettoReplace,
    herettoAtLastSavedLocation,
    onBrowseFromRoot,
    herettoRootUuid,
  } = useHerettoCms({
    activeTab,
    tabs,
    setTabs,
    setActiveTabId,
    setConfirmModal,
  });

  // ADR-013: the connected map's key registry, app-wide; chips read it from context.
  const keyRegistry = useKeyRegistry();
  const { reload: reloadMap, disconnect: disconnectMap } = keyRegistry;
  const [isConnectMapOpen, setIsConnectMapOpen] = useState(false);

  // External content loading hook
  useExternalLoad({
    createTab,
    setTabs,
    setActiveTabId,
  });

  const {
    theme: appTheme,
    syntaxTheme,
    isKeyboardShortcutsOpen,
    setIsKeyboardShortcutsOpen,
    handleThemeChange,
    handleSyntaxThemeChange,
  } = useEditorUi({
    activeTabId,
    tabs,
    setTabs,
  });

  // ADR-017: the one owner of the workbench's layout (W1); W3's rule lives in the hook.
  const workbench = useWorkbenchLayout({ activeReviewKey: activeTab?.pendingReview ? activeTab.id : null });
  const { layout } = workbench;

  // FR-045/FR-057: accept/reject a pendingReview staged by the API insert or PUT path.
  const handleReviewAccept = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab?.pendingReview) return;
    if (tab.xmlContent !== tab.pendingReview.baseXml) {
      toast.error('Document changed since this proposal was created. Review cancelled. Re-send the request.');
      updateTab(tabId, { pendingReview: null });
      return;
    }
    // ADR-008 / FR-057: warn when live tracked-change marks are about to be
    // discarded by the Accept re-parse (the FR-056 SyncManager bypass destroys
    // TrackedTextNode marks when xmlContent is committed with lastUpdatedBy:'api').
    // Reachable now that insertSection no longer blocks in suggesting mode.
    if (tab.documentMode === 'suggesting' && tab.trackedChangeCount > 0) {
      toast(`Applying this proposal discarded ${tab.trackedChangeCount} unresolved suggestion(s)`);
    }
    updateTab(tabId, {
      xmlContent: tab.pendingReview.proposedXml,
      lastUpdatedBy: 'api',
      syncTrigger: tab.syncTrigger + 1,
      pendingReview: null,
      herettoDirty: tab.herettoFile ? true : tab.herettoDirty,
    });
    toast.success('Proposed change applied');
  }, [tabs, updateTab]);

  const handleReviewReject = useCallback((tabId: string) => {
    updateTab(tabId, { pendingReview: null });
    toast.info('Proposed change rejected');
  }, [updateTab]);

  // Register native app API bridge — activates only when running inside the Swift WKWebView (dita:// protocol)
  useEffect(() => {
    registerNativeApiBridge({
      getTabs: () => tabs,
      getActiveTabId: () => activeTabId,
      getHerettoConnected: () => herettoConnected,
      getTheme: () => appTheme,
      updateTab,
      handleHerettoSave,
      setTabs,
      setActiveTabId,
    });
  }, [tabs, activeTabId, herettoConnected, appTheme, updateTab, handleHerettoSave, setTabs, setActiveTabId]);

  const {
    fileInputRef,
    isSaveModalOpen,
    setIsSaveModalOpen,
    saveFileName,
    setSaveFileName,
    isDragOver,
    openSaveModal,
    handleSaveConfirm,
    handleUploadClick,
    handleFileChange,
  } = useLocalFile({
    activeTab,
    tabs,
    setTabs,
    setActiveTabId,
  });

  // Sync hint — show only when one editor has unsynchronized changes
  const prevSyncLastUpdatedByRef = useRef<string | undefined>(undefined);
  const prevSyncTriggerRef = useRef<number | undefined>(undefined);
  const prevSyncTabIdRef = useRef<string | undefined>(undefined);
  const [syncHintVisible, setSyncHintVisible] = useState(false);

  useEffect(() => {
    if (!activeTab) { setSyncHintVisible(false); return; }

    if (activeTab.id !== prevSyncTabIdRef.current) {
      prevSyncTabIdRef.current = activeTab.id;
      prevSyncLastUpdatedByRef.current = activeTab.lastUpdatedBy;
      prevSyncTriggerRef.current = activeTab.syncTrigger;
      setSyncHintVisible(false);
      return;
    }

    if (prevSyncTriggerRef.current !== undefined && activeTab.syncTrigger !== prevSyncTriggerRef.current) {
      setSyncHintVisible(false);
    } else if (prevSyncLastUpdatedByRef.current !== undefined && activeTab.lastUpdatedBy !== prevSyncLastUpdatedByRef.current) {
      setSyncHintVisible(true);
    }

    prevSyncLastUpdatedByRef.current = activeTab.lastUpdatedBy;
    prevSyncTriggerRef.current = activeTab.syncTrigger;
  }, [activeTab?.id, activeTab?.lastUpdatedBy, activeTab?.syncTrigger]);

  const handlePrint = useCallback(() => {
    const title = derivePrintTitle(
      activeTab.localFileName,
      activeTab.herettoFile?.name ?? null,
    );
    const html = generatePrintHtml(activeTab.xmlContent, title);

    // Native macOS app (ADR-016 decision 6 / FR-050 slice 1): the Swift
    // PrintExporter runs the save panel, renders the HTML in a dedicated hidden
    // web view, prints it to a paginated PDF with page-number footers, and
    // reports back through window.__ditaApi.exportFinished — which shows the
    // toast. Nothing to say here until the file exists.
    if (postNativePrint(html, title)) return;

    // Browser fallback: hidden iframe avoids the popup-blocker that triggers when
    // using window.open().
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      toast.error('Print failed: could not create print frame');
      return;
    }

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    const cleanup = () => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    };

    iframe.contentWindow?.addEventListener('afterprint', cleanup);

    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(cleanup, 1000);
    }, 250);

    toast.success('Print dialog opened');
  }, [activeTab.xmlContent, activeTab.localFileName, activeTab.herettoFile?.name]);

  // ADR-016 decision 3: the macOS menu bar's bridge. Each method calls the same
  // handler the in-app control calls. Re-registers (merging into the shared
  // __ditaApi object) whenever a handler changes — not on every keystroke.
  // ADR-013 amendment (v1.2.0): Open from Heretto shows the Search view and focuses its box.
  const [searchFocusRequest, setSearchFocusRequest] = useState(0);
  const { showView } = workbench;
  const openFromHeretto = useCallback(() => {
    showView('search');
    setSearchFocusRequest(n => n + 1);
  }, [showView]);
  // Every non-Explorer way of finding a file opens it through the same import flow, with real ancestry.
  // The one door every Heretto open goes through: a map connects and shows the Map view (it would open
  // as a blank topic, FR-079); anything else opens as a topic through the import flow.
  const { connect: connectMap, connectedMap } = keyRegistry;
  const openHerettoItem = useCallback((item: HerettoSearchResult) => {
    if (isDitamapName(item.name)) {
      showView('map');
      if (connectedMap?.uuid !== item.uuid) void connectMap(item.uuid);
      return;
    }
    void handleHerettoOpen(item);
  }, [showView, connectedMap?.uuid, connectMap, handleHerettoOpen]);
  const openHerettoFile = useCallback((file: { uuid: string; name: string; folderUuid: string }, fallbackPath?: string) => {
    if (isDitamapName(file.name)) { openHerettoItem({ ...file, type: 'file', path: file.name, ancestorUuids: [] }); return; }
    void openableItem(file, herettoRootUuid, fallbackPath).then(openHerettoItem);
  }, [herettoRootUuid, openHerettoItem]);
  const openSearchHit = useCallback((hit: SearchHit, scopeIsRoot: boolean) => {
    // The hit's path is relative to the search scope; it is the right fallback only when that is the root (review finding 16).
    openHerettoFile({ uuid: hit.uuid, name: hit.name, folderUuid: hit.folderUuid }, scopeIsRoot ? hit.path : undefined);
  }, [openHerettoFile]);
  const openFileUuids = new Set(tabs.map(t => t.herettoFile?.uuid).filter((u): u is string => !!u));
  const activeFolder = activeTab.herettoFile?.parentFolderUuid
    ? { uuid: activeTab.herettoFile.parentFolderUuid, name: activeTab.herettoFile.path.split('/').slice(-2, -1)[0] || 'this folder' }
    : null;

  const activeHasReplaceTarget = !!activeTab?.herettoReplaceTarget;
  // The diff modal needs a target; without one, pick it in the browser first.
  // One handler for the File menu, the Explorer menu and the rail popover (Gate 7).
  const openReplace = useCallback(() => {
    if (activeHasReplaceTarget) setIsHerettoReplaceModalOpen(true);
    else void openHerettoBrowser('replace');
  }, [activeHasReplaceTarget, openHerettoBrowser]);

  useEffect(() => {
    registerNativeMenuBridge({
      getActiveTabId: () => activeTabId,
      handleNewTopic,
      handleCloseTab,
      handleHerettoSave: () => handleHerettoSave(),
      openReplace,
      exportPdf: handlePrint,
      openHerettoStatus,
      // The bridge's Open from Heretto row shows the Search view; Save/Replace still pick in the dialog.
      openHerettoBrowser: async (mode) => { if (mode === 'open') openFromHeretto(); else await openHerettoBrowser(mode); },
      openReleaseNotes: () => setIsReleaseNotesOpen(true),
      openKeyboardShortcuts: () => setIsKeyboardShortcutsOpen(true),
      togglePanel: workbench.togglePanel,
      toggleRightRail: workbench.toggleRail,
      focusView: workbench.focusView,
      openConvertModal: () => setIsConvertModalOpen(true),
      openConnectMapModal: () => setIsConnectMapOpen(true),
      reloadMap: () => { void reloadMap(); },
      disconnectMap,
      setTheme: handleThemeChange,
      setXmlTheme: handleSyntaxThemeChange,
      getTheme: () => appTheme,
      getXmlTheme: () => syntaxTheme,
    });
  }, [
    activeTabId, handleNewTopic, handleCloseTab, handleHerettoSave, openHerettoBrowser, openReplace,
    openHerettoStatus, handlePrint, handleThemeChange, handleSyntaxThemeChange, appTheme, syntaxTheme,
    setIsKeyboardShortcutsOpen, workbench.togglePanel, workbench.toggleRail, workbench.focusView,
    reloadMap, disconnectMap, openFromHeretto,
  ]);

  // ADR-016 decision 5: the View menu's check marks come from this push.
  useEffect(() => {
    pushNativeUiState({ theme: appTheme, syntaxTheme });
  }, [appTheme, syntaxTheme]);

  const handleFormatClick = () => {
    const monacoApiRef = activeTab.monacoApiRef;
    if (!monacoApiRef?.current) return;

    try {
      const currentValue = activeTab.xmlContent;
      const formattedValue = formatXml(currentValue);

      if (formattedValue !== currentValue) {
        updateTab(activeTab.id, { xmlContent: formattedValue, lastUpdatedBy: 'code' });
        toast.success('XML formatted successfully');
      }
    } catch (error) {
      console.error('XML formatting error:', error);
      toast.error('Failed to format XML: Check for syntax errors');
    }
  };

  return (
    <KeyRegistryContext.Provider value={keyRegistry.registry}>
    <div className="h-screen flex flex-col overflow-hidden" data-theme={appTheme} style={{ backgroundColor: 'var(--app-bg)' }}>
      {/* Drop overlay */}
      {isDragOver && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        >
          <div
            className="rounded-2xl px-10 py-8 flex flex-col items-center gap-3"
            style={{
              backgroundColor: 'var(--app-surface)',
              border: '2px dashed var(--editor-accent)',
            }}
          >
            <FolderOpen className="w-10 h-10" style={{ color: 'var(--editor-accent)' }} />
            <span className="text-lg font-semibold" style={{ color: 'var(--app-text-primary)' }}>
              Drop .dita or .xml file to open
            </span>
          </div>
        </div>
      )}

      {/* Heretto Status Modal */}
      {isHerettoStatusOpen && (
        <HerettoStatusModal
          herettoConnected={herettoConnected}
          herettoStatusChecking={herettoStatusChecking}
          herettoCredentials={herettoCredentials}
          setHerettoCredentials={setHerettoCredentials}
          testHerettoConnection={testHerettoConnection}
          saveHerettoCredentials={saveHerettoCredentials}
          onClose={() => setIsHerettoStatusOpen(false)}
        />
      )}

      {/* Connect a Map (P2-27) — also the failure modal for a failed connect or reload */}
      {(isConnectMapOpen || keyRegistry.error) && (
        <ConnectMapModal
          connectedMapName={keyRegistry.connectedMap?.name ?? null}
          host={herettoCredentials.host}
          rootUuid={herettoRootUuid}
          herettoConnected={herettoConnected}
          loading={keyRegistry.loading}
          error={keyRegistry.error}
          onConnect={keyRegistry.connect}
          onClearError={keyRegistry.clearError}
          onClose={() => setIsConnectMapOpen(false)}
        />
      )}

      {/* Pre-save content-model violation (FR-067 / ADR-014) — blocks Save to Heretto */}
      {contentModelViolations && contentModelViolations.length > 0 && (
        <ContentModelViolationModal
          violations={contentModelViolations}
          onClose={() => setContentModelViolations(null)}
        />
      )}

      {/* Release Notes Modal */}
      {isReleaseNotesOpen && (
        <ReleaseNotesModal onClose={() => setIsReleaseNotesOpen(false)} />
      )}

      {/* Keyboard Shortcuts Modal */}
      {isKeyboardShortcutsOpen && (
        <KeyboardShortcutsModal onClose={() => setIsKeyboardShortcutsOpen(false)} />
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal(null)}
        />
      )}

      {exitSuggestingConfirm && (
        <ExitEditModeModal
          changeCount={tabs.find(t => t.id === exitSuggestingConfirm.tabId)?.trackedChangeCount ?? 0}
          onAccept={() => {
            // Bump the trigger; SuggestionPlugin resolves marks, serializes,
            // and its onAcceptAll callback applies the requested target mode.
            setTabs(prev => prev.map(t => t.id === exitSuggestingConfirm.tabId ? { ...t, acceptAllTrigger: t.acceptAllTrigger + 1 } : t));
          }}
          onReject={() => {
            setTabs(prev => prev.map(t => t.id === exitSuggestingConfirm.tabId ? { ...t, rejectAllTrigger: t.rejectAllTrigger + 1 } : t));
          }}
          onCancel={() => setExitSuggestingConfirm(null)}
        />
      )}

      {/* New Topic Modal */}
      {isNewTopicModalOpen && (
        <TopicTypeModal
          title="New Topic"
          description="Select a DITA topic type to start with."
          onSelect={handleNewTopic}
          onClose={() => setIsNewTopicModalOpen(false)}
        />
      )}

      {/* Convert Topic Modal */}
      {isConvertModalOpen && (
        <TopicTypeModal
          title="Convert Topic Type"
          description="Select the target DITA topic type. This will update the root element and body tag."
          // P2-25 slice 2: troubleshooting is a New Topic option, not a Convert
          // target — see the `types` prop's doc comment on TopicTypeModal.
          types={['task', 'concept', 'reference']}
          onSelect={handleConvertTopic}
          onClose={() => setIsConvertModalOpen(false)}
          disabledType={currentTopicType}
        />
      )}

      {/* Save Topic Modal */}
      {isSaveModalOpen && (
        <SaveTopicModal
          saveFileName={saveFileName}
          setSaveFileName={setSaveFileName}
          onSave={handleSaveConfirm}
          onClose={() => setIsSaveModalOpen(false)}
        />
      )}

      {/* Heretto Browser Modal */}
      {isHerettoBrowserOpen && (
        <HerettoBrowserModal
          mode={herettoBrowserMode}
          rootUuid={herettoRootUuid}
          breadcrumbs={herettoBreadcrumbs}
          setBreadcrumbs={setHerettoBreadcrumbs}
          selected={herettoSelected}
          setSelected={setHerettoSelected}
          browsing={herettoBrowsing}
          items={herettoItems}
          navigate={herettoNavigate}
          onPick={(item) => {
            // Replace: the picked file becomes this tab's replace target.
            const pathStr = herettoBreadcrumbs.slice(1).map(b => b.name).concat(item.name).join('/');
            setTabs(prev => prev.map(t =>
              t.id === activeTab?.id
                ? { ...t, herettoReplaceTarget: { uuid: item.uuid, name: item.name, path: pathStr } }
                : t
            ));
            setIsHerettoBrowserOpen(false);
          }}
          saveFileName={herettoSaveFileName}
          setSaveFileName={setHerettoSaveFileName}
          saving={herettoSaving}
          onSaveNew={handleHerettoSaveNew}
          onClose={() => setIsHerettoBrowserOpen(false)}
          isLastSavedLocation={herettoAtLastSavedLocation}
          onBrowseFromRoot={onBrowseFromRoot}
        />
      )}

      {/* Import Verification Modal */}
      {importVerification && (
        <ImportVerificationModal
          data={importVerification}
          onClose={() => setImportVerification(null)}
          onContinue={handleImportContinue}
        />
      )}

      {/* Heretto Replace Modal */}
      {isHerettoReplaceModalOpen && activeTab && activeTab.herettoReplaceTarget && (
        <HerettoReplaceModal
          isOpen={isHerettoReplaceModalOpen}
          target={{
            uuid: activeTab.herettoReplaceTarget.uuid,
            name: activeTab.herettoReplaceTarget.name || `Unknown File`,
            path: activeTab.herettoReplaceTarget.path || `Unknown Path`,
          }}
          editorContent={activeTab.xmlContent}
          onReplace={handleHerettoReplace}
          onClose={() => setIsHerettoReplaceModalOpen(false)}
        />
      )}

      {/* Open Local File… in the browser (the Explorer menu); the native app uses its NSOpenPanel (ADR-016 decision 4). */}
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".dita,.xml" />

      {/* ADR-017 decision 1: the 34 px title row (brand + tab strip). The header dropdowns are gone (decision 4). */}
      <TitleBar
        version={APP_VERSION}
        tabs={tabs.map(t => ({
          id: t.id,
          name: t.herettoFile?.name ?? t.localFileName ?? 'Untitled',
          dirty: t.xmlContent !== t.savedXmlRef.current,
          pendingReview: !!t.pendingReview,
        }))}
        activeTabId={activeTabId}
        onActivateTab={setActiveTabId}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
        onOpenReleaseNotes={() => setIsReleaseNotesOpen(true)}
      />

      {/* The main row: activity bar · side panel · editor + XML split · panel column · right rail */}
      <div className="flex-1 flex overflow-hidden" data-testid="workbench">
        <ActivityBar
          activeView={layout.activeView}
          sidePanelOpen={layout.sidePanelOpen}
          onFocusView={workbench.focusView}
          heretto={{
            connected: herettoConnected,
            checking: herettoStatusChecking,
            host: herettoCredentials.host,
            email: herettoCredentials.email,
            rootUuid: herettoRootUuid,
            onTest: () => { void testHerettoConnection(); },
            onOpenCredentials: () => { void openHerettoStatus(); },
            onOpenFromHeretto: openFromHeretto,
            onSave: () => { void handleHerettoSave(); },
            onReplace: openReplace,
            onDisconnect: activeTab.herettoFile ? handleHerettoDisconnect : null,
          }}
          settings={{
            version: APP_VERSION,
            onOpenCredentials: () => { void openHerettoStatus(); },
            onKeyboardShortcuts: () => setIsKeyboardShortcutsOpen(true),
            onReleaseNotes: () => setIsReleaseNotesOpen(true),
            theme: appTheme,
            onThemeChange: handleThemeChange,
            syntaxTheme,
            onSyntaxThemeChange: handleSyntaxThemeChange,
          }}
        />

        {/* Hidden, not unmounted, when collapsed: the views keep their state (review finding 7). */}
        <div style={{ display: layout.sidePanelOpen ? 'contents' : 'none' }} data-testid="side-panel-host">
          <SidePanel width={layout.sidePanelWidth} onResize={workbench.setSidePanelWidth}>
            {/* Every view stays mounted so a switch keeps its state (Search's query and results, review finding 7). */}
            <div className="flex-1 flex flex-col min-h-0" style={{ display: layout.activeView === 'explorer' ? 'flex' : 'none' }}>
              <ExplorerView
                tabs={tabs.map(t => ({
                  id: t.id,
                  name: t.herettoFile?.name ?? t.localFileName ?? 'Untitled',
                  dirty: t.xmlContent !== t.savedXmlRef.current,
                  pendingReview: !!t.pendingReview,
                  herettoUuid: t.herettoFile?.uuid ?? null,
                }))}
                activeTabId={activeTabId}
                onActivateTab={setActiveTabId}
                onCloseTab={handleCloseTab}
                herettoConnected={herettoConnected}
                rootUuid={herettoRootUuid}
                host={herettoCredentials.host}
                onOpenTopic={openHerettoItem}
                filenameSearch={{ run: herettoSearch, results: herettoSearchResults, status: herettoSearchStatus, abortRef: herettoSearchAbortRef }}
                commands={{
                  onNewTopic: () => setIsNewTopicModalOpen(true),
                  onOpenLocalFile: handleUploadClick,
                  onOpenFromHeretto: openFromHeretto,
                  onSaveToHeretto: () => { void handleHerettoSave(); },
                  onSaveLocalCopy: openSaveModal,
                  onReplace: openReplace,
                  onExportPdf: handlePrint,
                  onConvertTopicType: () => setIsConvertModalOpen(true),
                  onConnectMap: () => setIsConnectMapOpen(true),
                  connectedMapName: keyRegistry.connectedMap?.name ?? null,
                  onReloadMap: () => { void reloadMap(); },
                  onDisconnectMap: disconnectMap,
                  onKeyboardShortcuts: () => setIsKeyboardShortcutsOpen(true),
                }}
              />
            </div>
            <div className="flex-1 flex flex-col min-h-0" style={{ display: layout.activeView === 'search' ? 'flex' : 'none' }}>
              <SearchView
                herettoConnected={herettoConnected}
                host={herettoCredentials.host}
                rootUuid={herettoRootUuid}
                currentFolder={activeFolder}
                focusRequest={searchFocusRequest}
                onOpenHit={openSearchHit}
                onOpenCredentials={() => { void openHerettoStatus(); }}
                onTestConnection={() => { void testHerettoConnection(); }}
              />
            </div>
            <div className="flex-1 flex flex-col min-h-0" style={{ display: layout.activeView === 'map' ? 'flex' : 'none' }}>
              <MapView
                registry={keyRegistry.registry}
                connectedMap={keyRegistry.connectedMap}
                loading={keyRegistry.loading}
                herettoConnected={herettoConnected}
                openFileUuids={openFileUuids}
                onConnect={() => setIsConnectMapOpen(true)}
                onReload={() => { clearHerettoPathCache(); void reloadMap(); }}
                onDisconnect={disconnectMap}
                onOpenTopic={file => openHerettoFile(file)}
              />
            </div>
            {layout.activeView === 'scm' && <PlaceholderView view="scm" />}
          </SidePanel>
        </div>

        {/* The editor column and the XML split share this container (the split's percentage is of its width). */}
        <div className="flex-1 flex min-w-0 min-h-0" ref={splitContainerRef} data-testid="editor-split">
          {/* VISUAL EDITOR (Lexical) — one per tab, show/hide */}
          <div
            className="flex flex-col min-w-0 min-h-0 relative group"
            style={{
              backgroundColor: 'var(--editor-canvas-bg)',
              borderRight: layout.panels.xml.open ? '1px solid var(--app-border)' : 'none',
              flex: '1 1 0%',
            }}
          >
          {/* First-run sync hint */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex justify-center">
            <CoachMark />
          </div>
          {tabs.map(tab => (
            <LexicalComposer key={tab.id} initialConfig={{ ...editorConfig, namespace: `DitaEditor-${tab.id}` }}>
              <div
                className={`flex-1 relative flex flex-col min-h-0 overflow-hidden ${tab.documentMode === 'suggesting' ? 'dita-editor-edit-mode-container' : ''}`}
                style={{ display: tab.id === activeTabId ? 'flex' : 'none' }}
              >
                <Toolbar
                  currentTheme={appTheme}
                  onThemeChange={handleThemeChange}
                  documentMode={tab.documentMode}
                  onModeChange={(mode) => {
                    if (mode === tab.documentMode) return;
                    if (tab.documentMode === 'suggesting' && tab.trackedChangeCount > 0) {
                      // Unresolved changes: confirm accept/reject-all first.
                      setExitSuggestingConfirm({ tabId: tab.id, targetMode: mode });
                      return;
                    }
                    updateTab(tab.id, { documentMode: mode });
                    if (mode === 'suggesting') toast('Suggesting mode: edits become tracked changes');
                  }}
                  trackedChangeCount={tab.trackedChangeCount}
                  onAcceptAll={() => setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, acceptAllTrigger: t.acceptAllTrigger + 1 } : t))}
                  onRejectAll={() => setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, rejectAllTrigger: t.rejectAllTrigger + 1 } : t))}
                />
                {/* Document mode badge (anything but plain editing) */}
                {tab.documentMode !== 'editing' && (
                  <div className="dita-editor-edit-mode-badge">{tab.documentMode === 'suggesting' ? 'Suggesting' : 'Viewing'}</div>
                )}
                {/* Heretto Replace Bar */}
                {tab.herettoReplaceTarget && (
                  <HerettoReplaceBar
                    targetName={tab.herettoReplaceTarget.name || `File ${tab.herettoReplaceTarget.uuid.slice(0, 8)}...`}
                    onPreviewDiff={() => setIsHerettoReplaceModalOpen(true)}
                    onReplace={() => setIsHerettoReplaceModalOpen(true)}
                    onDismiss={() => {
                      setTabs(prev => prev.map(t =>
                        t.id === tab.id ? { ...t, herettoReplaceTarget: null } : t
                      ));
                    }}
                  />
                )}
                {/* Heretto Context Toolbar */}
                {tab.herettoFile && (
                  <div
                    className="absolute top-10 left-0 right-0 h-9 flex items-center justify-between px-4 z-10"
                    style={{
                      backgroundColor: 'color-mix(in srgb, #0d9488 6%, var(--app-surface))',
                      borderBottom: '1px solid color-mix(in srgb, #14b8a6 20%, var(--app-border))',
                    }}
                  >
                    {/* Left: logo + breadcrumb path */}
                    <div className="flex items-center gap-2 text-xs min-w-0">
                      <HerettoLogo className="w-3.5 h-3.5 shrink-0" style={{ color: '#14b8a6' }} />
                      <div className="flex items-center gap-1 min-w-0 truncate" style={{ color: 'var(--app-text-muted)' }}>
                        {tab.herettoFile.path.split('/').filter(Boolean).map((segment, i, arr) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span style={{ opacity: 0.4 }}>/</span>}
                            <span style={i === arr.length - 1 ? { color: 'var(--app-text-primary)', fontWeight: 500 } : undefined}>
                              {segment}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>

                    {/* Right: status + actions */}
                    <div className="flex items-center gap-3 text-xs shrink-0">
                      <div className="flex items-center gap-1.5" style={{ color: 'var(--app-text-muted)' }}>
                        {herettoSaveProgress === 'saving' ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            <span>Saving to Heretto...</span>
                          </>
                        ) : herettoSaveProgress === 'verifying' ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            <span>Verifying save...</span>
                          </>
                        ) : tab.herettoJustLoaded ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                            <span>Loaded from Heretto</span>
                          </>
                        ) : tab.herettoRemoteChanged ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                            <span>{tab.herettoDirty ? 'Changes in both locations' : 'Updated in Heretto'}</span>
                          </>
                        ) : tab.herettoDirty ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            <span>Edited, not yet saved</span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                            <span>
                              Saved to Heretto{tab.herettoLastSaved ? ` ${formatRelativeTime(tab.herettoLastSaved)}` : ''}
                            </span>
                          </>
                        )}
                      </div>

                      <button
                        onClick={handleHerettoRefresh}
                        disabled={herettoRefreshing}
                        className="p-1 rounded transition-colors hover-text"
                        style={{ color: 'var(--app-text-muted)' }}
                        title="Refresh from Heretto"
                        aria-label="Refresh from Heretto"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${herettoRefreshing ? 'animate-spin' : ''}`} />
                      </button>

                      {tab.herettoDirty && (
                        <button
                          onClick={() => handleHerettoSave()}
                          disabled={herettoSaving}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors hover-heretto"
                          style={{
                            backgroundColor: '#0d9488',
                            color: '#ffffff',
                            border: '1px solid #14b8a6',
                          }}
                        >
                          {herettoSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CloudUpload className="w-3 h-3" />}
                          Save to Heretto
                        </button>
                      )}

                      <button
                        onClick={handleHerettoDisconnect}
                        className="p-1 rounded transition-colors hover-text"
                        style={{ color: 'var(--app-text-muted)' }}
                        title="Disconnect from Heretto"
                        aria-label="Disconnect from Heretto"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
                <div className={`flex-1 overflow-y-auto custom-scrollbar pb-10 relative ${tab.herettoFile ? 'pt-[92px]' : 'pt-14'}`}>
                  <div
                    className="max-w-6xl mx-auto mt-1 mb-12 rounded-lg relative"
                    style={{
                      backgroundColor: 'var(--editor-page-bg)',
                      boxShadow: 'var(--editor-page-shadow)',
                      border: 'var(--editor-page-border)',
                      padding: '3rem',
                    }}
                  >
                    <RichTextPlugin
                      contentEditable={<ContentEditable className="outline-none min-h-[500px]" />}
                      placeholder={
                        <div className="absolute italic pointer-events-none leading-relaxed" style={{ top: '3rem', left: '3rem', color: 'var(--app-text-muted)' }}>
                          Start typing your DITA content here...
                        </div>
                      }
                      ErrorBoundary={LexicalErrorBoundary}
                    />
                  </div>
                  <HistoryPlugin />
                  <ListPlugin />
                  <LinkPlugin />
                  <TablePlugin />
                  <TableInsertPlugin />
                  <ClearEditorPlugin />
                  <EmptyToH1Plugin />
                  <SyncManager
                    xmlContent={tab.xmlContent}
                    onLexicalChange={(xml: string) => updateTab(tab.id, { xmlContent: xml, lastUpdatedBy: 'editor' })}
                    lastUpdatedBy={tab.lastUpdatedBy}
                    syncTrigger={tab.syncTrigger}
                    suspendSync={tab.documentMode === 'suggesting'}
                    onValidationTrigger={() => updateTab(tab.id, { validationTrigger: tab.validationTrigger + 1 })}
                  >
                    <ShortdescPlugin topicType={currentTopicType} />
                    <InsertElementPlugin suggesting={tab.documentMode === 'suggesting'} />
                    <InlineWrapPlugin />
                    <InsertVariablePlugin />
                    <TokenFormatResetPlugin />
                    <CascadeSeparatorPlugin />
                    <XrefValidationPlugin />
                    <HerettoImageResolverPlugin
                      herettoFile={tab.herettoFile}
                      syncTrigger={tab.syncTrigger}
                    />
                    <SuggestionPlugin
                      tabId={tab.id}
                      documentMode={tab.documentMode}
                      acceptAllTrigger={tab.acceptAllTrigger}
                      rejectAllTrigger={tab.rejectAllTrigger}
                      onAcceptAll={(tabId) => {
                        // The resolved XML arrives via SyncManager's onLexicalChange (ADR-015).
                        const target = exitSuggestingConfirm?.tabId === tabId ? exitSuggestingConfirm.targetMode : 'editing';
                        updateTab(tabId, { documentMode: target });
                        setExitSuggestingConfirm(null);
                      }}
                      onRejectAll={(tabId) => {
                        const target = exitSuggestingConfirm?.tabId === tabId ? exitSuggestingConfirm.targetMode : 'editing';
                        updateTab(tabId, { documentMode: target });
                        setExitSuggestingConfirm(null);
                      }}
                      onChangeCountChanged={(tabId, count) => updateTab(tabId, { trackedChangeCount: count })}
                      onCarriedMarks={(tabId, count) => {
                        // ADR-015 decision 6: a topic saved with suggestions opens in Suggesting mode.
                        setTabs(prev => prev.map(t => t.id === tabId && t.documentMode === 'editing' ? { ...t, documentMode: 'suggesting' } : t));
                        toast(`${count} suggestion${count === 1 ? '' : 's'} carried from Heretto: opened in Suggesting mode`);
                      }}
                    />
                    {/* Inside SyncManager so it can read an xref's scope/format (ADR-013 decision 8). */}
                    <InlineValidationPlugin
                      xmlContent={tab.xmlContent}
                      validationTrigger={tab.validationTrigger}
                      onValidationResults={(errors) => updateTab(tab.id, { inlineValidationErrors: errors })}
                      herettoFolderUuid={tab.herettoFile?.parentFolderUuid ?? null}
                      herettoFileUuid={tab.herettoFile?.uuid ?? null}
                    />
                  </SyncManager>
                  <TableColumnSizer />
                  <TableActionMenuPlugin />
                </div>
                <ChangeListPanel documentMode={tab.documentMode} xmlContent={tab.xmlContent} />
                <BottomToolbar lastUpdatedBy={tab.lastUpdatedBy} syncHintVisible={tab.id === activeTabId && syncHintVisible} />
              </div>
            </LexicalComposer>
          ))}
          </div>

          <XmlSplit
            open={layout.panels.xml.open}
            sizePct={layout.panels.xml.size}
            containerRef={splitContainerRef}
            onResize={pct => workbench.setPanelSize('xml', pct)}
            onClose={() => workbench.closePanel('xml')}
            tabs={tabs}
            activeTabId={activeTabId}
            activeTab={activeTab}
            updateTab={updateTab}
            appTheme={appTheme}
            syntaxTheme={syntaxTheme}
            onSyntaxThemeChange={handleSyntaxThemeChange}
            wordWrapEnabled={wordWrapEnabled}
            onToggleWordWrap={toggleWordWrap}
            currentTopicType={currentTopicType}
            onFormat={handleFormatClick}
            onReviewAccept={handleReviewAccept}
            onReviewReject={handleReviewReject}
          />
        </div>

        {!layout.railHidden && (
          <>
            <PanelColumn
              open={workbench.openStackPanels}
              panels={layout.panels}
              width={layout.panelColumnWidth}
              onResizeColumn={workbench.setPanelColumnWidth}
              onResizePanel={workbench.setPanelSize}
              onClose={workbench.closePanel}
            />
            <RightRail panels={layout.panels} onToggle={workbench.togglePanel} />
          </>
        )}
      </div>
    </div>
    </KeyRegistryContext.Provider>
  );
}
