import React, { useCallback, useRef, useState } from 'react';
import { Code, CheckCircle, AlertTriangle, AlertCircle, Code2, WrapText, PanelRightClose } from 'lucide-react';
import { Tooltip } from '../Tooltip';
import { Popover } from './Popover';
import { ReviewBar } from '../ReviewBar';
import { DiffViewer } from '../DiffViewer';
import { MonacoDitaEditor, type XmlError } from '../MonacoDitaEditor';
import { syntaxModeMismatch, syntaxThemeLabel, type SyntaxThemeName, type ThemeName } from '../../lib/appearance';
import type { Tab } from '../../types/tab';
import { XML_SPLIT } from '../../lib/workbench-layout';

interface XmlSplitProps {
  open: boolean;
  /** The split's percentage of the editor-plus-XML container (`containerRef`). */
  sizePct: number;
  /** The flex container holding the editor column, this handle and this column: the drag's reference frame. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  onResize: (pct: number) => void;
  onClose: () => void;

  tabs: Tab[];
  activeTabId: string;
  activeTab: Tab;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  /** The active appearance profile's base and syntax theme (ADR-018); chosen in Settings ▸ Appearance. */
  appTheme: ThemeName;
  syntaxTheme: SyntaxThemeName;
  wordWrapEnabled: boolean;
  onToggleWordWrap: () => void;
  currentTopicType: string;
  onFormat: () => void;
  onReviewAccept: (tabId: string) => void;
  onReviewReject: (tabId: string) => void;
}

/**
 * ADR-017 decision 2: today's XML pane, relocated — the same toolbar, the same
 * per-tab Monaco stack (one editor per tab, show/hide; a `pendingReview` swaps
 * in the ReviewBar + DiffViewer, ADR-008), the same footer — as a split that
 * covers a draggable share of the editor area and is closed by default. When
 * closed the column is hidden, not unmounted, so every Monaco model keeps its
 * cursor, scroll and undo stack (W7). `MonacoDitaEditor` itself is untouched.
 */
export const XmlSplit = ({
  open, sizePct, containerRef, onResize, onClose,
  tabs, activeTabId, activeTab, updateTab, appTheme, syntaxTheme,
  wordWrapEnabled, onToggleWordWrap, currentTopicType, onFormat, onReviewAccept, onReviewReject,
}: XmlSplitProps) => {
  const [dragging, setDragging] = useState(false);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const problemsButtonRef = useRef<HTMLButtonElement>(null);

  const onHandleDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    const move = (ev: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      // The split's share is measured from the container's right edge (the rail sits outside it).
      onResize(((rect.right - ev.clientX) / rect.width) * 100);
    };
    const up = () => {
      setDragging(false);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }, [containerRef, onResize]);

  const errorCount = activeTab.xmlErrors.filter(e => e.severity === 'error').length;
  const pct = Math.min(XML_SPLIT.max, Math.max(XML_SPLIT.min, sizePct));

  return (
    <>
      {open && (
        <div
          className="w-1 shrink-0 cursor-col-resize flex flex-col items-center justify-center group/handle transition-colors hover:bg-sky-500/10"
          onMouseDown={onHandleDown}
          title="Drag to resize; below 20 % closes the XML"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize XML"
          data-testid="xml-split-handle"
        >
          <div className="flex flex-col gap-0.5 opacity-0 group-hover/handle:opacity-100 transition-opacity">
            {[0, 1, 2].map(i => <div key={i} className="w-0.5 h-0.5 rounded-full" style={{ backgroundColor: 'var(--app-text-muted)' }} />)}
          </div>
        </div>
      )}

      <div
        className="flex flex-col min-w-0 relative"
        style={{
          display: open ? 'flex' : 'none',
          backgroundColor: 'var(--app-bg)',
          flex: `0 0 ${pct}%`,
          transition: dragging ? 'none' : 'flex 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
        }}
        data-testid="xml-split"
        aria-hidden={!open}
      >
        {/* XML toolbar */}
        <div
          className="h-10 flex items-center px-4 justify-between shrink-0"
          style={{ backgroundColor: 'var(--app-surface-raised)', borderBottom: '1px solid var(--app-border-subtle)' }}
        >
          {/* ADR-018: the syntax-theme menu that lived here is part of the appearance profile now. */}
          <span
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-2 py-1 select-none"
            style={{ color: 'var(--app-text-muted)' }}
          >
            <Code className="w-4 h-4" />
            XML
          </span>

          <div className="flex items-center gap-2">
            {syntaxModeMismatch(appTheme, syntaxTheme) && (
              <Tooltip content={`${syntaxThemeLabel(syntaxTheme)} does not match this profile's ${appTheme === 'light' ? 'light' : 'dark'} page. Change it in Settings ▸ Appearance.`}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--editor-note-warning)' }} />
              </Tooltip>
            )}
            <Tooltip content={wordWrapEnabled ? 'Disable word wrap' : 'Enable word wrap'}>
              <button
                onClick={onToggleWordWrap}
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
              <button onClick={onFormat} className="p-1 rounded transition-colors hover-app-text" style={{ color: 'var(--app-text-muted)' }} aria-label="Format XML">
                <Code2 className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
            <Tooltip content="Close XML (⌘\)">
              <button onClick={onClose} className="p-1 rounded transition-colors hover-app-text" style={{ color: 'var(--app-text-muted)' }} aria-label="Close XML" data-testid="xml-close">
                <PanelRightClose className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Monaco editors — one per tab, show/hide. A pendingReview (FR-045 / ADR-008)
            swaps the editor for a read-only Monaco diff + Accept/Reject bar. */}
        {tabs.map(tab => (
          <div
            key={tab.id}
            className="flex-1 overflow-hidden pt-2"
            style={{ display: tab.id === activeTabId ? 'flex' : 'none', flexDirection: 'column' }}
          >
            {tab.pendingReview ? (
              <>
                <ReviewBar
                  sourceLabel={tab.pendingReview.sourceLabel}
                  onAccept={() => onReviewAccept(tab.id)}
                  onReject={() => onReviewReject(tab.id)}
                />
                <DiffViewer
                  originalContent={tab.pendingReview.baseXml}
                  modifiedContent={tab.pendingReview.proposedXml}
                  originalLabel="Current"
                  modifiedLabel={tab.pendingReview.sourceLabel ?? 'Proposed'}
                  grow
                />
              </>
            ) : (
              <MonacoDitaEditor
                value={tab.xmlContent}
                onChange={(newXml: string) => updateTab(tab.id, { xmlContent: newXml, lastUpdatedBy: 'code' })}
                onValidation={(hasErrors: boolean, errors?: XmlError[]) => {
                  updateTab(tab.id, { hasXmlErrors: hasErrors, xmlErrors: errors || [] });
                  if (!hasErrors) setProblemsOpen(false);
                }}
                editorTheme={appTheme}
                syntaxTheme={syntaxTheme}
                wordWrapEnabled={wordWrapEnabled}
                onEditorReady={(api) => { tab.monacoApiRef.current = api; }}
                onFormat={onFormat}
              />
            )}
          </div>
        ))}

        {/* Footer */}
        <div
          className="h-8 flex items-center px-4 justify-between text-[10px] font-mono relative"
          style={{ backgroundColor: 'var(--app-surface)', borderTop: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}
        >
          <div className="flex items-center gap-3">
            <span>UTF-8</span>
            <span>DITA 1.3</span>
          </div>
          <button
            ref={problemsButtonRef}
            className={`flex items-center gap-1.5 ${activeTab.hasXmlErrors ? 'text-red-400 hover:text-red-300' : 'text-emerald-500'}`}
            style={{ cursor: activeTab.hasXmlErrors ? 'pointer' : 'default', background: 'none', border: 'none', font: 'inherit', fontSize: 'inherit' }}
            onClick={() => { if (activeTab.hasXmlErrors) setProblemsOpen(o => !o); }}
            aria-haspopup={activeTab.hasXmlErrors ? 'dialog' : undefined}
            aria-expanded={activeTab.hasXmlErrors ? problemsOpen : undefined}
          >
            {activeTab.hasXmlErrors ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
            {activeTab.hasXmlErrors ? `${errorCount} Error${errorCount !== 1 ? 's' : ''}` : 'Valid XML'}
          </button>

          <Popover open={problemsOpen && activeTab.xmlErrors.length > 0} onClose={() => setProblemsOpen(false)} anchorRef={problemsButtonRef} placement="top-end" role="dialog" ariaLabel="Problems" width={420}>
            <div className="max-h-64 overflow-y-auto font-mono text-xs" style={{ color: 'var(--app-text-secondary)' }}>
              <div
                className="px-3 py-2 font-semibold text-[11px] uppercase tracking-wider sticky top-0"
                style={{ backgroundColor: 'var(--app-surface-raised)', borderBottom: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}
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
                    setProblemsOpen(false);
                  }}
                >
                  <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${err.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="leading-snug" style={{ color: err.severity === 'error' ? '#f87171' : '#fbbf24' }}>{err.message}</div>
                    <div className="mt-0.5" style={{ color: 'var(--app-text-muted)' }}>Line {err.line}, Column {err.column}</div>
                  </div>
                </button>
              ))}
            </div>
          </Popover>
        </div>
      </div>
    </>
  );
};
