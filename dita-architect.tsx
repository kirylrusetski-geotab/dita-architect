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
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { TableNode, TableRowNode, TableCellNode, $createTableNode, $createTableRowNode, $createTableCellNode, TableCellHeaderStates } from '@lexical/table';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { ParagraphNode, TextNode, $getSelection, $isRangeSelection, $createParagraphNode, COMMAND_PRIORITY_EDITOR } from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { MonacoDitaEditor } from './components/MonacoDitaEditor';
import { Toolbar } from './components/Toolbar';
import { BottomToolbar } from './components/BottomToolbar';
import { Tooltip } from './components/Tooltip';
import { SyncManager } from './components/SyncManager';
import { TableColumnSizer } from './components/TableColumnSizer';
import { TableActionMenuPlugin } from './components/TableActionMenuPlugin';
import { EditModePlugin } from './components/EditModePlugin';
import { SectionInsertPlugin } from './components/SectionInsertPlugin';
import { TrackedChangesPlugin } from './components/TrackedChangesPlugin';
import { EmptyToH1Plugin } from './components/EmptyToH1Plugin';
import { ShortdescPlugin } from './components/ShortdescPlugin';
import { InsertElementPlugin } from './components/InsertElementPlugin';
import { HerettoImageResolverPlugin } from './components/HerettoImageResolverPlugin';
import { XrefValidationPlugin } from './components/XrefValidationPlugin';
import { DitaOpaqueNode } from './components/DitaOpaqueNode';
import { DitaCodeBlockNode } from './components/DitaCodeBlockNode';
import { DitaImageNode } from './components/DitaImageNode';
import { DitaPhRefNode } from './components/DitaPhRefNode';
import { DitaInfoPreviewNode } from './components/DitaInfoPreviewNode';
import { TrackedDeletionNode } from './components/TrackedDeletionNode';
import { ValidationDecoratorNode } from './components/ValidationDecoratorNode';
import { InlineValidationPlugin } from './components/InlineValidationPlugin';
import { Code, CheckCircle, AlertTriangle, AlertCircle, BookOpen, Save, FolderOpen, RefreshCw, FilePlus, ChevronDown, CloudUpload, FileText, Loader2, X, PanelRightClose, PanelRightOpen, Upload, Code2, Printer, WrapText, Keyboard } from 'lucide-react';
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
import { SYNTAX_THEME_OPTIONS } from './components/MonacoDitaEditor';
import type { XmlError } from './components/MonacoDitaEditor';
import { formatRelativeTime, formatXml, validateDitaXml } from './lib/xml-utils';
import { generatePrintHtml, derivePrintTitle } from './lib/dita-print';
import { updateEditorStatus, updateTabsState, setSyncTriggerCallback, setSaveHandlerCallback } from './lib/editor-state-bridge';
import { registerNativeApiBridge } from './lib/native-api-bridge';
import { useEditorUi } from './hooks/useEditorUi';
import { useTabManager } from './hooks/useTabManager';
import { createTab } from './types/tab';
import { useLocalFile } from './hooks/useLocalFile';
import { useHerettoCms } from './hooks/useHerettoCms';
import { useExternalLoad } from './hooks/useExternalLoad';
import { EDITOR_NODES } from './constants/editor-nodes';

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
  const [exitEditModeConfirmTabId, setExitEditModeConfirmTabId] = useState<string | null>(null);
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

  // Split-pane resize
  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(() => {
    const stored = localStorage.getItem('ditaSplitWidth');
    return stored ? parseFloat(stored) : 50;
  });
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [isSplitDragging, setIsSplitDragging] = useState(false);
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsSplitDragging(true);
    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const pct = Math.max(20, Math.min(80, ((ev.clientX - rect.left) / rect.width) * 100));
      setLeftPaneWidth(pct);
      localStorage.setItem('ditaSplitWidth', String(pct));
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsSplitDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

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
    isHerettoDropdownOpen,
    setIsHerettoDropdownOpen,
    herettoDropdownRef,
    herettoSaveFileName,
    setHerettoSaveFileName,
    herettoRefreshing,
    herettoSearchQuery,
    setHerettoSearchQuery,
    herettoSearchResults,
    herettoSearchStatus,
    setHerettoSearchStatus,
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
  } = useHerettoCms({
    activeTab,
    tabs,
    setTabs,
    setActiveTabId,
    setConfirmModal,
  });

  // External content loading hook
  useExternalLoad({
    createTab,
    setTabs,
    setActiveTabId,
  });

  const {
    theme: appTheme,
    syntaxTheme,
    isSyntaxThemeOpen,
    setIsSyntaxThemeOpen,
    codeEditorCollapsed,
    setCodeEditorCollapsed,
    syntaxDropdownRef,
    showErrorPanel,
    setShowErrorPanel,
    errorPanelRef,
    isFileOptionsOpen,
    setIsFileOptionsOpen,
    fileOptionsRef,
    isKeyboardShortcutsOpen,
    setIsKeyboardShortcutsOpen,
    handleThemeChange,
    handleSyntaxThemeChange,
  } = useEditorUi({
    activeTabId,
    tabs,
    setTabs,
    herettoDropdownRef,
    setIsHerettoDropdownOpen,
  });

  // Sync state to server for read-only API endpoints
  useEffect(() => {
    updateEditorStatus({ herettoConnected, theme: appTheme });
  }, [herettoConnected, appTheme]);

  useEffect(() => {
    updateTabsState(tabs, activeTabId);
  }, [tabs, activeTabId]);

  // Register callbacks for API-triggered operations
  useEffect(() => {
    setSyncTriggerCallback((tabId: string, xmlContent: string) => {
      const tab = tabs.find(t => t.id === tabId);
      if (!tab) return false;
      updateTab(tabId, { xmlContent, lastUpdatedBy: 'api', syncTrigger: tab.syncTrigger + 1 });
      return true;
    });

    setSaveHandlerCallback(async (tabId: string) => {
      const tab = tabs.find(t => t.id === tabId);
      if (!tab) {
        return { success: false, error: 'Tab not found' };
      }
      if (!tab.herettoFile) {
        return { success: false, error: 'Tab has no associated Heretto file' };
      }

      try {
        await handleHerettoSave(tabId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error during save'
        };
      }
    });
  }, [updateTab, handleHerettoSave, tabs]);

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

  const handlePrint = () => {
    const title = derivePrintTitle(
      activeTab.localFileName,
      activeTab.herettoFile?.name ?? null,
    );
    const html = generatePrintHtml(activeTab.xmlContent, title);

    // In the native macOS app, delegate to the Swift PrintBridge, which writes
    // the HTML to a temp file and opens it in the system browser. The user then
    // presses ⌘P in the browser to get the print dialog and save as PDF.
    // (window.print() and WKWebView.printOperation both produce blank output.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nativeBridge = (window as any).webkit?.messageHandlers?.ditaPrint;
    if (nativeBridge) {
      nativeBridge.postMessage(html);
      toast.success('Opened in browser — press ⌘P to save as PDF');
      return;
    }

    // Browser fallback: hidden iframe avoids the popup-blocker that triggers when
    // using window.open().
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      toast.error('Print failed — could not create print frame');
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
  };

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

      {exitEditModeConfirmTabId && (
        <ExitEditModeModal
          onAccept={() => {
            setTabs(prev => prev.map(t => t.id === exitEditModeConfirmTabId ? { ...t, editModeAcceptTrigger: t.editModeAcceptTrigger + 1 } : t));
            setExitEditModeConfirmTabId(null);
          }}
          onReject={() => {
            setTabs(prev => prev.map(t => t.id === exitEditModeConfirmTabId ? { ...t, editModeRejectTrigger: t.editModeRejectTrigger + 1 } : t));
            setExitEditModeConfirmTabId(null);
          }}
          onCancel={() => setExitEditModeConfirmTabId(null)}
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
          searchQuery={herettoSearchQuery}
          setSearchQuery={setHerettoSearchQuery}
          breadcrumbs={herettoBreadcrumbs}
          setBreadcrumbs={setHerettoBreadcrumbs}
          searchAbortRef={herettoSearchAbortRef}
          search={herettoSearch}
          searchStatus={herettoSearchStatus}
          setSearchStatus={setHerettoSearchStatus}
          searchResults={herettoSearchResults}
          selected={herettoSelected}
          setSelected={setHerettoSelected}
          browsing={herettoBrowsing}
          items={herettoItems}
          navigate={herettoNavigate}
          onOpen={(item) => {
            if (herettoBrowserMode === 'replace') {
              // Set replace target for current tab
              const pathStr = 'path' in item && item.path
                ? item.path
                : herettoBreadcrumbs.slice(1).map(b => b.name).join('/') + '/' + item.name;

              setTabs(prev => prev.map(t =>
                t.id === activeTab?.id
                  ? { ...t, herettoReplaceTarget: { uuid: item.uuid, name: item.name, path: pathStr } }
                  : t
              ));
              setIsHerettoBrowserOpen(false);
            } else {
              // Normal open behavior
              handleHerettoOpen(item);
            }
          }}
          saveFileName={herettoSaveFileName}
          setSaveFileName={setHerettoSaveFileName}
          saving={herettoSaving}
          onSaveNew={handleHerettoSaveNew}
          onCreateNew={() => { setIsHerettoBrowserOpen(false); setIsNewTopicModalOpen(true); }}
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

      {/* Top Bar */}
      <div
        className="h-16 flex items-center justify-between px-6 shrink-0"
        style={{
          backgroundColor: 'var(--app-surface)',
          borderBottom: '1px solid var(--app-border)',
          zIndex: 30,
          position: 'relative',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-dita-500 to-dita-600 flex items-center justify-center shadow-lg shadow-dita-500/20">
              <BookOpen className="text-white w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--app-text-primary)' }}>
                  DITA <span className="text-dita-500">Architect</span>
                </h2>
                <button
                  onClick={() => setIsReleaseNotesOpen(true)}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full transition-colors cursor-pointer hover-app"
                  style={{
                    color: 'var(--app-text-muted)',
                    backgroundColor: 'var(--app-surface-raised)',
                    border: '1px solid var(--app-border-subtle)',
                  }}
                  aria-label="View release notes"
                >
                  v{APP_VERSION}
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                <span className={`w-1.5 h-1.5 rounded-full ${activeTab.lastUpdatedBy === 'editor' ? 'bg-purple-500' : 'bg-blue-500'}`}></span>
                Last update: {activeTab.lastUpdatedBy === 'editor' ? 'Visual Editor' : 'Source Code'}
                {syncHintVisible && (
                  <span style={{ opacity: 0.6 }}>&middot; Press Ctrl+Enter to sync between editors</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".dita,.xml"
          />

          {/* File Options dropdown */}
          <div className="relative" ref={fileOptionsRef}>
            <button
              onClick={() => setIsFileOptionsOpen(prev => !prev)}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  if (!isFileOptionsOpen) setIsFileOptionsOpen(true);
                  setTimeout(() => {
                    const first = fileOptionsRef.current?.querySelector('[role="menuitem"]') as HTMLElement | null;
                    first?.focus();
                  }, 0);
                }
              }}
              aria-haspopup="true"
              aria-expanded={isFileOptionsOpen}
              className="flex items-center gap-2 px-3 py-1.5 rounded transition-all text-xs font-medium hover-btn hover-text"
              style={{
                backgroundColor: 'var(--app-surface-raised)',
                color: 'var(--app-text-secondary)',
                border: '1px solid var(--app-border-subtle)',
              }}
            >
              <FileText className="w-3.5 h-3.5" />
              File Options
              <ChevronDown className={`w-3 h-3 transition-transform ${isFileOptionsOpen ? 'rotate-180' : ''}`} />
            </button>

            {isFileOptionsOpen && (
              <div
                className="absolute top-full right-0 mt-1 rounded-lg shadow-xl border py-1 z-20"
                role="menu"
                onKeyDown={e => {
                  const items = Array.from(fileOptionsRef.current?.querySelectorAll('[role="menuitem"]') ?? []) as HTMLElement[];
                  const idx = items.indexOf(e.target as HTMLElement);
                  if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length]?.focus(); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); }
                  else if (e.key === 'Escape') { e.preventDefault(); setIsFileOptionsOpen(false); }
                }}
                style={{
                  backgroundColor: 'var(--app-surface-raised)',
                  borderColor: 'var(--app-border-subtle)',
                  minWidth: '100%',
                }}
              >
                <button
                  role="menuitem"
                  onClick={() => { setIsFileOptionsOpen(false); setIsNewTopicModalOpen(true); }}
                  className="w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap hover-app"
                  style={{ color: 'var(--app-text-secondary)' }}
                >
                  <FilePlus className="w-3.5 h-3.5" />
                  New
                </button>
                <button
                  role="menuitem"
                  onClick={() => { setIsFileOptionsOpen(false); handleUploadClick(); }}
                  className="w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap hover-app"
                  style={{ color: 'var(--app-text-secondary)' }}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Open
                </button>
                <button
                  role="menuitem"
                  onClick={() => { setIsFileOptionsOpen(false); openSaveModal(); }}
                  className="w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap hover-app"
                  style={{ color: 'var(--app-text-secondary)' }}
                >
                  <Save className="w-3.5 h-3.5" />
                  Save
                </button>
                <button
                  role="menuitem"
                  onClick={() => { setIsFileOptionsOpen(false); handlePrint(); }}
                  className="w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap hover-app"
                  style={{ color: 'var(--app-text-secondary)' }}
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / Export PDF
                </button>
                <div className="my-1 mx-2" style={{ borderTop: '1px solid var(--app-border-subtle)' }} />
                <button
                  role="menuitem"
                  onClick={() => { setIsFileOptionsOpen(false); setIsConvertModalOpen(true); }}
                  className="w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap hover-app"
                  style={{ color: 'var(--app-text-secondary)' }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Convert
                </button>
                <div className="my-1 mx-2" style={{ borderTop: '1px solid var(--app-border-subtle)' }} />
                <button
                  role="menuitem"
                  onClick={() => { setIsFileOptionsOpen(false); setIsKeyboardShortcutsOpen(true); }}
                  className="w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap hover-app"
                  style={{ color: 'var(--app-text-secondary)' }}
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  Keyboard Shortcuts
                </button>
              </div>
            )}
          </div>

          {/* Heretto CMS dropdown */}
          <div className="relative" ref={herettoDropdownRef}>
            <button
              onClick={() => setIsHerettoDropdownOpen(prev => !prev)}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  if (!isHerettoDropdownOpen) setIsHerettoDropdownOpen(true);
                  setTimeout(() => {
                    const first = herettoDropdownRef.current?.querySelector('[role="menuitem"]') as HTMLElement | null;
                    first?.focus();
                  }, 0);
                }
              }}
              aria-haspopup="true"
              aria-expanded={isHerettoDropdownOpen}
              className="flex items-center gap-2 px-3 py-1.5 rounded shadow-lg transition-all text-xs font-medium hover-heretto"
              style={{
                backgroundColor: '#0d9488',
                color: '#ffffff',
                border: '1px solid #14b8a6',
              }}
            >
              <HerettoLogo className="w-4 h-4" />
              Heretto
              <ChevronDown className={`w-3 h-3 transition-transform ${isHerettoDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isHerettoDropdownOpen && (
              <div
                className="absolute top-full right-0 mt-1 rounded-lg shadow-xl border py-1 z-20"
                role="menu"
                onKeyDown={e => {
                  const items = Array.from(herettoDropdownRef.current?.querySelectorAll('[role="menuitem"]') ?? []) as HTMLElement[];
                  const idx = items.indexOf(e.target as HTMLElement);
                  if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length]?.focus(); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); }
                  else if (e.key === 'Escape') { e.preventDefault(); setIsHerettoDropdownOpen(false); }
                }}
                style={{
                  backgroundColor: 'var(--app-surface-raised)',
                  borderColor: 'var(--app-border-subtle)',
                  minWidth: '100%',
                }}
              >
                {herettoConnected && (
                  <>
                    <button
                      role="menuitem"
                      onClick={() => { setIsHerettoDropdownOpen(false); openHerettoBrowser('open'); }}
                      className="w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap hover-app"
                      style={{ color: 'var(--app-text-secondary)' }}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Open
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { setIsHerettoDropdownOpen(false); handleHerettoSave(); }}
                      className="w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap hover-app"
                      style={{ color: 'var(--app-text-secondary)' }}
                    >
                      <CloudUpload className="w-3.5 h-3.5" />
                      Save
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { setIsHerettoDropdownOpen(false); openHerettoBrowser('replace'); }}
                      className="w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap hover-app"
                      style={{ color: 'var(--app-text-secondary)' }}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Replace existing...
                    </button>
                    <div className="my-1 mx-2" style={{ borderTop: '1px solid var(--app-border-subtle)' }} />
                  </>
                )}
                  <button
                    role="menuitem"
                    onClick={() => { setIsHerettoDropdownOpen(false); openHerettoStatus(); }}
                    className="w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap hover-app"
                    style={{ color: 'var(--app-text-secondary)' }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: herettoConnected ? '#10b981' : '#ef4444' }}
                    />
                    Status
                  </button>
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div
        className="h-[34px] flex items-end shrink-0 overflow-x-auto tab-bar-no-scrollbar"
        style={{
          backgroundColor: 'var(--app-surface)',
          borderBottom: '1px solid var(--app-border)',
          scrollbarWidth: 'none',
        }}
      >
        <div className="flex items-end h-full min-w-0">
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId;
            const isDirty = tab.xmlContent !== tab.savedXmlRef.current;
            const tabName = tab.herettoFile?.name ?? tab.localFileName ?? 'Untitled';
            return (
              <div
                key={tab.id}
                className="flex items-center gap-1.5 pl-3 pr-1 h-[32px] text-xs font-medium cursor-pointer select-none shrink-0 max-w-[180px] group/tab"
                style={{
                  backgroundColor: isActive ? 'var(--editor-canvas-bg)' : 'transparent',
                  borderTop: isActive ? '2px solid var(--editor-accent)' : '2px solid transparent',
                  borderRight: '1px solid var(--app-border-subtle)',
                  color: isActive ? 'var(--app-text-primary)' : 'var(--app-text-muted)',
                  marginBottom: isActive ? '-1px' : '0',
                }}
                onClick={() => setActiveTabId(tab.id)}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'var(--app-hover)';
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {isDirty && (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: 'var(--editor-accent)' }}
                  />
                )}
                <span className="truncate">{tabName}</span>
                <button
                  className="p-0.5 rounded opacity-0 group-hover/tab:opacity-100 transition-opacity ml-auto shrink-0 hover-text"
                  style={{ color: 'var(--app-text-muted)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(tab.id);
                  }}
                  title="Close tab"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
        <button
          className="flex items-center justify-center w-[34px] h-[32px] shrink-0 transition-colors hover-app-text"
          style={{ color: 'var(--app-text-muted)' }}
          onClick={handleNewTab}
          title="New tab"
        >
          <FilePlus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Split View Container */}
      <div className="flex-1 flex overflow-hidden" ref={splitContainerRef}>
        {/* LEFT: VISUAL EDITOR (Lexical) — one per tab, show/hide */}
        <div
          className="flex flex-col min-w-0 min-h-0 relative group"
          style={{
            backgroundColor: 'var(--editor-canvas-bg)',
            borderRight: '1px solid var(--app-border)',
            flex: codeEditorCollapsed ? '1 1 0%' : `0 0 ${leftPaneWidth}%`,
            transition: isSplitDragging ? 'none' : 'flex 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* First-run sync hint */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex justify-center">
            <CoachMark />
          </div>
          {tabs.map(tab => (
            <LexicalComposer key={tab.id} initialConfig={{ ...editorConfig, namespace: `DitaEditor-${tab.id}` }}>
              <div
                className={`flex-1 relative flex flex-col min-h-0 overflow-hidden ${tab.editMode ? 'dita-editor-edit-mode-container' : ''}`}
                style={{ display: tab.id === activeTabId ? 'flex' : 'none' }}
              >
                <Toolbar
                  currentTheme={appTheme}
                  onThemeChange={handleThemeChange}
                  editMode={tab.editMode}
                  onEnterEditMode={() => {
                    if (tab.editMode) {
                      setExitEditModeConfirmTabId(tab.id);
                    } else {
                      setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, editModeEnterTrigger: t.editModeEnterTrigger + 1 } : t));
                    }
                  }}
                  onAcceptEdits={() => setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, editModeAcceptTrigger: t.editModeAcceptTrigger + 1 } : t))}
                  onRejectEdits={() => setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, editModeRejectTrigger: t.editModeRejectTrigger + 1 } : t))}
                />
                {/* Edit Mode Badge */}
                {tab.editMode && (
                  <div className="dita-editor-edit-mode-badge">Edit Mode</div>
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
                            <span>Edited — not yet saved</span>
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
                  <XrefValidationPlugin />
                  <SyncManager
                    xmlContent={tab.xmlContent}
                    onLexicalChange={(xml: string) => updateTab(tab.id, { xmlContent: xml, lastUpdatedBy: 'editor' })}
                    lastUpdatedBy={tab.lastUpdatedBy}
                    syncTrigger={tab.syncTrigger}
                    editMode={tab.editMode}
                    onValidationTrigger={() => updateTab(tab.id, { validationTrigger: tab.validationTrigger + 1 })}
                  >
                    <ShortdescPlugin />
                    <InsertElementPlugin />
                    <HerettoImageResolverPlugin
                      herettoFile={tab.herettoFile}
                      syncTrigger={tab.syncTrigger}
                    />
                    <EditModePlugin
                      tabId={tab.id}
                      editMode={tab.editMode}
                      masterXml={tab.xmlContent}
                      snapshotRef={tab.snapshotRef}
                      enterTrigger={tab.editModeEnterTrigger}
                      acceptTrigger={tab.editModeAcceptTrigger}
                      rejectTrigger={tab.editModeRejectTrigger}
                      onEnterEditMode={(tabId) => updateTab(tabId, { editMode: true })}
                      onAcceptEdits={(tabId, xml) => updateTab(tabId, { editMode: false, xmlContent: xml, lastUpdatedBy: 'editor' })}
                      onRejectEdits={(tabId) => updateTab(tabId, { editMode: false })}
                    />
                    <SectionInsertPlugin tabId={tab.id} />
                  </SyncManager>
                  <InlineValidationPlugin
                    xmlContent={tab.xmlContent}
                    validationTrigger={tab.validationTrigger}
                    onValidationResults={(errors) => updateTab(tab.id, { inlineValidationErrors: errors })}
                  />
                  <TableColumnSizer />
                  <TableActionMenuPlugin />
                  <TrackedChangesPlugin
                    editMode={tab.editMode}
                    snapshotRef={tab.snapshotRef}
                    enterTrigger={tab.editModeEnterTrigger}
                  />
                </div>
                <BottomToolbar />
              </div>
            </LexicalComposer>
          ))}
        </div>

        {/* Resize handle between visual and XML panes */}
        {!codeEditorCollapsed && (
          <div
            className="w-1 shrink-0 cursor-col-resize flex flex-col items-center justify-center group/handle transition-colors hover:bg-sky-500/10"
            onMouseDown={handleDragStart}
            title="Drag to resize"
          >
            <div className="flex flex-col gap-0.5 opacity-0 group-hover/handle:opacity-100 transition-opacity">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-0.5 h-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--app-text-muted)' }}
                />
              ))}
            </div>
          </div>
        )}

        {/* RIGHT: CODE EDITOR (Monaco) */}
        <div
          className="flex flex-col min-w-0 relative"
          style={{
            backgroundColor: 'var(--app-bg)',
            flex: codeEditorCollapsed ? '0 0 36px' : '1 1 0%',
            transition: 'flex 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden',
          }}
        >
          {/* Collapsed tab overlay */}
          <div
            className="absolute inset-0 flex flex-col items-center z-10"
            style={{
              backgroundColor: 'var(--app-surface-raised)',
              opacity: codeEditorCollapsed ? 1 : 0,
              pointerEvents: codeEditorCollapsed ? 'auto' : 'none',
              transition: 'opacity 200ms ease',
              cursor: 'pointer',
            }}
            onClick={() => setCodeEditorCollapsed(false)}
            aria-label="Expand XML editor"
          >
            <Tooltip content="Expand" placement="left">
              <div className="p-2">
                <PanelRightOpen className="w-4 h-4" style={{ color: 'var(--app-text-muted)' }} />
              </div>
            </Tooltip>
            <div
              className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap"
              style={{
                color: 'var(--app-text-muted)',
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                padding: '8px 0',
              }}
            >
              XML Source
            </div>
          </div>
          {/* XML Toolbar */}
          <div
            className="h-10 flex items-center px-4 justify-between shrink-0"
            style={{
              backgroundColor: 'var(--app-surface-raised)',
              borderBottom: '1px solid var(--app-border-subtle)',
            }}
          >
            <div className="relative" ref={syntaxDropdownRef}>
              <Tooltip content="Syntax theme">
                <button
                  onClick={() => setIsSyntaxThemeOpen(prev => !prev)}
                  onKeyDown={e => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      if (!isSyntaxThemeOpen) setIsSyntaxThemeOpen(true);
                      setTimeout(() => {
                        const first = syntaxDropdownRef.current?.querySelector('[role="menuitem"]') as HTMLElement | null;
                        first?.focus();
                      }, 0);
                    }
                  }}
                  aria-haspopup="true"
                  aria-expanded={isSyntaxThemeOpen}
                  aria-label={`Select syntax theme: ${SYNTAX_THEME_OPTIONS.find(t => t.value === syntaxTheme)?.label ?? 'XML Source'}`}
                  className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest rounded px-2 py-1 transition-colors hover-app"
                  style={{ color: 'var(--app-text-muted)' }}
                >
                  <Code className="w-4 h-4" />
                  {SYNTAX_THEME_OPTIONS.find(t => t.value === syntaxTheme)?.label ?? 'XML Source'}
                  <ChevronDown className={`w-3 h-3 transition-transform ${isSyntaxThemeOpen ? 'rotate-180' : ''}`} />
                </button>
              </Tooltip>

              {isSyntaxThemeOpen && (
                <div
                  className="absolute top-full left-0 mt-1 rounded-lg shadow-xl border py-1 min-w-[140px] z-20"
                  role="menu"
                  onKeyDown={e => {
                    const items = Array.from(syntaxDropdownRef.current?.querySelectorAll('[role="menuitem"]') ?? []) as HTMLElement[];
                    const idx = items.indexOf(e.target as HTMLElement);
                    if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length]?.focus(); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); }
                    else if (e.key === 'Escape') { e.preventDefault(); setIsSyntaxThemeOpen(false); }
                  }}
                  style={{
                    backgroundColor: 'var(--app-surface-raised)',
                    borderColor: 'var(--app-border-subtle)',
                  }}
                >
                  {SYNTAX_THEME_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      role="menuitem"
                      onClick={() => {
                        handleSyntaxThemeChange(opt.value);
                        setIsSyntaxThemeOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs font-medium transition-colors flex items-center justify-between hover-app"
                      style={{
                        color: opt.value === syntaxTheme
                          ? 'var(--editor-accent, #0ea5e9)'
                          : 'var(--app-text-secondary)',
                      }}
                    >
                      {opt.label}
                      {opt.value === syntaxTheme && <span>&#10003;</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {SYNTAX_THEME_OPTIONS.find(o => o.value === syntaxTheme)?.mode === 'light' && appTheme !== 'light' && (
                <Tooltip content="Daylight is a light syntax theme — pairs best with the Light visual theme">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--editor-note-warning)' }} />
                </Tooltip>
              )}
              <Tooltip content={wordWrapEnabled ? 'Disable word wrap' : 'Enable word wrap'}>
                <button
                  onClick={toggleWordWrap}
                  className="p-1 rounded transition-colors hover-app-text"
                  style={{ color: wordWrapEnabled ? 'var(--editor-accent)' : 'var(--app-text-muted)' }}
                  aria-label="Toggle word wrap"
                  aria-pressed={wordWrapEnabled}
                >
                  <WrapText className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
              {currentTopicType && currentTopicType !== 'undefined' && (
                <Tooltip content={`${currentTopicType.charAt(0).toUpperCase() + currentTopicType.slice(1)} topic`} placement="bottom">
                  <div
                    className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider"
                    style={{
                      backgroundColor: `var(--badge-${currentTopicType}-bg, var(--app-surface-raised))`,
                      border: `1px solid var(--badge-${currentTopicType}-border, var(--app-border-subtle))`,
                      color: `var(--badge-${currentTopicType}-text, var(--app-text-muted))`,
                    }}
                  >
                    {currentTopicType}
                  </div>
                </Tooltip>
              )}
              <Tooltip content="Format XML (Shift+Alt+F)">
                <button
                  onClick={handleFormatClick}
                  className="p-1 rounded transition-colors hover-app-text"
                  style={{ color: 'var(--app-text-muted)' }}
                  aria-label="Format XML"
                >
                  <Code2 className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
              <Tooltip content="Collapse">
                <button
                  onClick={() => setCodeEditorCollapsed(true)}
                  className="p-1 rounded transition-colors hover-app-text"
                  style={{ color: 'var(--app-text-muted)' }}
                  aria-label="Collapse XML editor"
                >
                  <PanelRightClose className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Monaco editors — one per tab, show/hide */}
          {tabs.map(tab => (
            <div
              key={tab.id}
              className="flex-1 overflow-hidden pt-2"
              style={{ display: tab.id === activeTabId ? 'flex' : 'none', flexDirection: 'column' }}
            >
              <MonacoDitaEditor
                value={tab.xmlContent}
                onChange={(newXml: string) => updateTab(tab.id, { xmlContent: newXml, lastUpdatedBy: 'code' })}
                onValidation={(hasErrors: boolean, errors?: XmlError[]) => {
                  updateTab(tab.id, { hasXmlErrors: hasErrors, xmlErrors: errors || [] });
                  if (!hasErrors) setShowErrorPanel(false);
                }}
                editorTheme={appTheme}
                syntaxTheme={syntaxTheme}
                wordWrapEnabled={wordWrapEnabled}
                onEditorReady={(api) => { tab.monacoApiRef.current = api; }}
                onFormat={handleFormatClick}
              />
            </div>
          ))}

          {/* Code Status Footer */}
          <div
            className="h-8 flex items-center px-4 justify-between text-[10px] font-mono relative"
            style={{
              backgroundColor: 'var(--app-surface)',
              borderTop: '1px solid var(--app-border)',
              color: 'var(--app-text-muted)',
            }}
          >
            <div className="flex items-center gap-3">
              <span>UTF-8</span>
              <span>DITA 1.3</span>
            </div>
            <button
              className={`flex items-center gap-1.5 ${activeTab.hasXmlErrors ? 'text-red-400 hover:text-red-300' : 'text-emerald-500'}`}
              style={{ cursor: activeTab.hasXmlErrors ? 'pointer' : 'default', background: 'none', border: 'none', font: 'inherit', fontSize: 'inherit' }}
              onClick={() => { if (activeTab.hasXmlErrors) setShowErrorPanel(prev => !prev); }}
            >
              {activeTab.hasXmlErrors ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
              {activeTab.hasXmlErrors ? `${activeTab.xmlErrors.filter(e => e.severity === 'error').length} Error${activeTab.xmlErrors.filter(e => e.severity === 'error').length !== 1 ? 's' : ''}` : 'Valid XML'}
            </button>

            {/* Error details panel */}
            {showErrorPanel && activeTab.xmlErrors.length > 0 && (
              <div
                ref={errorPanelRef}
                className="absolute bottom-full right-0 mb-1 w-[420px] max-h-64 overflow-y-auto rounded shadow-lg text-xs font-mono z-50"
                style={{
                  backgroundColor: 'var(--app-surface-raised)',
                  border: '1px solid var(--app-border)',
                  color: 'var(--app-text-secondary)',
                }}
              >
                <div
                  className="px-3 py-2 font-semibold text-[11px] uppercase tracking-wider sticky top-0"
                  style={{
                    backgroundColor: 'var(--app-surface-raised)',
                    borderBottom: '1px solid var(--app-border)',
                    color: 'var(--app-text-muted)',
                  }}
                >
                  Problems
                </div>
                {activeTab.xmlErrors.map((err, idx) => (
                  <button
                    key={idx}
                    className="w-full text-left px-3 py-2 flex items-start gap-2 transition-colors hover-app"
                    style={{ borderBottom: '1px solid var(--app-border-subtle)' }}
                    onClick={() => {
                      activeTab.monacoApiRef.current?.revealLine(err.line, err.column);
                      setShowErrorPanel(false);
                    }}
                  >
                    {err.severity === 'error'
                      ? <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      : <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="leading-snug" style={{ color: err.severity === 'error' ? '#f87171' : '#fbbf24' }}>
                        {err.message}
                      </div>
                      <div className="mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                        Line {err.line}, Column {err.column}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
