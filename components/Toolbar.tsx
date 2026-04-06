import React, { useState, useRef, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  CLEAR_EDITOR_COMMAND,
  $getSelection,
  $isRangeSelection,
} from 'lexical';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list';
// Import custom table command from main component
import { INSERT_TABLE_COMMAND } from '../dita-architect';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $setBlocksType } from '@lexical/selection';
import { FileText, AlertTriangle, Heading1, Heading2, ListOrdered, List, Table, Undo, Redo, Trash2, Link, ChevronDown, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip } from './Tooltip';

export const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'claude', label: 'Claude' },
  { value: 'nord', label: 'Nord' },
  { value: 'solarized', label: 'Solarized' },
  { value: 'geotab', label: 'Geotab' },
] as const;

export type ThemeName = typeof THEME_OPTIONS[number]['value'];

export const THEME_DESCRIPTIONS: Record<ThemeName, string> = {
  dark: 'High contrast for low-light work',
  light: 'Comfortable for extended daytime use',
  claude: 'Familiar Claude.ai colors',
  nord: 'Muted arctic palette for focus',
  solarized: 'Reduced eye strain color science',
  geotab: 'Geotab brand colors',
};

interface ToolbarProps {
  currentTheme: ThemeName;
  onThemeChange: (theme: ThemeName) => void;
  editMode?: boolean;
  onEnterEditMode?: () => void;
  onAcceptEdits?: () => void;
  onRejectEdits?: () => void;
}

export const Toolbar = ({ currentTheme, onThemeChange, editMode = false, onEnterEditMode, onAcceptEdits, onRejectEdits }: ToolbarProps) => {
  const [editor] = useLexicalComposerContext();
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tableIncludeHeader, setTableIncludeHeader] = useState(true);
  const tableRowsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsThemeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatHeading = (headingSize: 'h1' | 'h2') => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createHeadingNode(headingSize));
      }
    });
  };

  const formatQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createQuoteNode());
      }
    });
  };

  const currentLabel = THEME_OPTIONS.find(t => t.value === currentTheme)?.label ?? 'Visual';

  return (
    <div
      className="absolute top-0 left-0 right-0 h-10 flex items-center px-4 gap-2 z-20"
      style={{
        backgroundColor: 'var(--editor-toolbar-bg)',
        borderBottom: '1px solid var(--editor-toolbar-border)',
      }}
    >
      <div className="relative" ref={dropdownRef}>
        <button
          aria-label={`Select theme: ${currentLabel}`}
          onClick={() => setIsThemeOpen(prev => !prev)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (!isThemeOpen) setIsThemeOpen(true);
              setTimeout(() => {
                const first = dropdownRef.current?.querySelector('[role="menuitem"]') as HTMLElement | null;
                first?.focus();
              }, 0);
            }
          }}
          aria-haspopup="true"
          aria-expanded={isThemeOpen}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest mr-2 rounded px-2 py-1 transition-colors hover-toolbar"
          style={{
            color: 'var(--editor-toolbar-text)',
          }}
        >
          <FileText className="w-4 h-4" />
          {currentLabel}
          <ChevronDown className={`w-3 h-3 transition-transform ${isThemeOpen ? 'rotate-180' : ''}`} />
        </button>

        {isThemeOpen && (
          <div
            className="absolute top-full left-0 mt-1 rounded-lg shadow-xl border py-1 min-w-[140px]"
            role="menu"
            onKeyDown={e => {
              const items = Array.from(dropdownRef.current?.querySelectorAll('[role="menuitem"]') ?? []) as HTMLElement[];
              const idx = items.indexOf(e.target as HTMLElement);
              if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length]?.focus(); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); }
              else if (e.key === 'Escape') { e.preventDefault(); setIsThemeOpen(false); }
            }}
            style={{
              backgroundColor: 'var(--editor-toolbar-bg)',
              borderColor: 'var(--editor-toolbar-border)',
              zIndex: 9999,
            }}
          >
            {THEME_OPTIONS.map(opt => (
              <Tooltip key={opt.value} content={THEME_DESCRIPTIONS[opt.value]} placement="right">
                <button
                  role="menuitem"
                  onClick={() => {
                    onThemeChange(opt.value);
                    setIsThemeOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-medium transition-colors flex items-center justify-between hover-toolbar"
                  style={{
                    color: opt.value === currentTheme
                      ? 'var(--editor-accent, #0ea5e9)'
                      : 'var(--editor-toolbar-text-strong)',
                  }}
                >
                  {opt.label}
                  {opt.value === currentTheme && <span>&#10003;</span>}
                </button>
              </Tooltip>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-4 mx-2" style={{ backgroundColor: 'var(--editor-toolbar-divider)' }} />
      <Tooltip content="Undo">
        <button aria-label="Undo" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} className="p-1 rounded transition-colors hover-toolbar" style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <Undo className="w-4 h-4" />
        </button>
      </Tooltip>
      <Tooltip content="Redo">
        <button aria-label="Redo" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} className="p-1 rounded transition-colors hover-toolbar" style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <Redo className="w-4 h-4" />
        </button>
      </Tooltip>
      <div className="w-px h-4 mx-2" style={{ backgroundColor: 'var(--editor-toolbar-divider)' }} />
      <Tooltip content="Heading 1">
        <button aria-label="Heading 1" onClick={() => formatHeading('h1')} className="p-1 rounded transition-colors hover-toolbar" style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <Heading1 className="w-4 h-4" />
        </button>
      </Tooltip>
      <Tooltip content="Heading 2">
        <button aria-label="Heading 2" onClick={() => formatHeading('h2')} className="p-1 rounded transition-colors hover-toolbar" style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <Heading2 className="w-4 h-4" />
        </button>
      </Tooltip>
      <div className="w-px h-4 mx-2" style={{ backgroundColor: 'var(--editor-toolbar-divider)' }} />
      <Tooltip content="Bold">
        <button aria-label="Bold" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')} className="p-1 rounded transition-colors hover-toolbar" style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <span className="font-bold font-serif">B</span>
        </button>
      </Tooltip>
      <Tooltip content="Italic">
        <button aria-label="Italic" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')} className="p-1 rounded transition-colors hover-toolbar" style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <span className="italic font-serif">I</span>
        </button>
      </Tooltip>
      <div className="w-px h-4 mx-2" style={{ backgroundColor: 'var(--editor-toolbar-divider)' }} />
      <Tooltip content="Numbered List">
        <button aria-label="Numbered list" onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)} className="p-1 rounded transition-colors hover-toolbar" style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <ListOrdered className="w-4 h-4" />
        </button>
      </Tooltip>
      <Tooltip content="Bulleted List">
        <button aria-label="Bulleted list" onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)} className="p-1 rounded transition-colors hover-toolbar" style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <List className="w-4 h-4" />
        </button>
      </Tooltip>
      <Tooltip content="Insert Table">
        <button aria-label="Insert table" onClick={() => {
          setTableRows(3);
          setTableCols(3);
          setTableIncludeHeader(true);
          setIsTableModalOpen(true);
          setTimeout(() => tableRowsInputRef.current?.focus(), 0);
        }} className="p-1 rounded transition-colors hover-toolbar" style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <Table className="w-4 h-4" />
        </button>
      </Tooltip>
      <div className="w-px h-4 mx-2" style={{ backgroundColor: 'var(--editor-toolbar-divider)' }} />
      <Tooltip content="Warning Note">
        <button aria-label="Warning note" onClick={() => formatQuote()} className="p-1 rounded transition-colors hover-toolbar" style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <AlertTriangle className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
      <Tooltip content="Insert Link">
        <button aria-label="Insert link" onClick={() => {
          setLinkUrl('');
          setLinkError('');
          setIsLinkModalOpen(true);
          setTimeout(() => linkInputRef.current?.focus(), 0);
        }} className="p-1 rounded transition-colors hover-toolbar" style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <Link className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
      <div className="w-px h-4 mx-2" style={{ backgroundColor: 'var(--editor-toolbar-divider)' }} />
      <Tooltip content="Enter Edit Mode">
        <button aria-label="Enter edit mode" onClick={onEnterEditMode} className="p-1 rounded transition-colors hover-toolbar" style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
      <div className="w-px h-4 mx-2" style={{ backgroundColor: 'var(--editor-toolbar-divider)' }} />
      <Tooltip content="Clear Contents">
        <button aria-label="Clear contents" onClick={() => { if (window.confirm('Clear all editor contents? This cannot be undone.')) { editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined); toast('Cleared editor contents'); } }} className="p-1 rounded transition-colors hover-toolbar" style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <Trash2 className="w-4 h-4" />
        </button>
      </Tooltip>

      {/* Insert Link Modal */}
      {isLinkModalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100 }}
          onClick={() => setIsLinkModalOpen(false)}
        >
          <div
            className="rounded-xl p-6 shadow-2xl w-[400px]"
            style={{
              backgroundColor: 'var(--app-surface)',
              border: '1px solid var(--app-border-subtle)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--app-text-primary)' }}>Insert Link</h3>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--app-text-secondary)' }}>
              URL
            </label>
            <input
              ref={linkInputRef}
              type="url"
              value={linkUrl}
              onChange={e => { setLinkUrl(e.target.value); setLinkError(''); }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const trimmed = linkUrl.trim().toLowerCase();
                  if (!linkUrl.trim()) return;
                  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) {
                    setLinkError('Invalid URL scheme');
                    return;
                  }
                  editor.dispatchCommand(TOGGLE_LINK_COMMAND, linkUrl.trim());
                  setIsLinkModalOpen(false);
                }
                if (e.key === 'Escape') setIsLinkModalOpen(false);
              }}
              placeholder="https://example.com"
              className="w-full px-3 py-2 rounded-lg text-sm mb-1"
              style={{
                backgroundColor: 'var(--app-surface-raised)',
                border: `1px solid ${linkError ? '#ef4444' : 'var(--app-border-subtle)'}`,
                color: 'var(--app-text-primary)',
                outline: 'none',
              }}
            />
            {linkError && (
              <p className="text-xs mb-2" style={{ color: '#ef4444' }}>{linkError}</p>
            )}
            {!linkError && (
              <p className="text-[10px] mb-4" style={{ color: 'var(--app-text-muted)' }}>
                Press Enter to insert, Escape to cancel.
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setIsLinkModalOpen(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors hover-btn"
                style={{
                  backgroundColor: 'var(--app-surface-raised)',
                  border: '1px solid var(--app-border-subtle)',
                  color: 'var(--app-text-secondary)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const trimmed = linkUrl.trim().toLowerCase();
                  if (!linkUrl.trim()) return;
                  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) {
                    setLinkError('Invalid URL scheme');
                    return;
                  }
                  editor.dispatchCommand(TOGGLE_LINK_COMMAND, linkUrl.trim());
                  setIsLinkModalOpen(false);
                }}
                disabled={!linkUrl.trim()}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Insert Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Insert Table Modal */}
      {isTableModalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100 }}
          onClick={() => setIsTableModalOpen(false)}
        >
          <div
            className="rounded-xl p-6 shadow-2xl w-[400px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="table-modal-title"
            style={{
              backgroundColor: 'var(--app-surface)',
              border: '1px solid var(--app-border-subtle)',
            }}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setIsTableModalOpen(false);
              }
            }}
          >
            <h3 id="table-modal-title" className="text-lg font-bold mb-4" style={{ color: 'var(--app-text-primary)' }}>Insert Table</h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--app-text-secondary)' }}>
                  Rows
                </label>
                <input
                  ref={tableRowsInputRef}
                  type="number"
                  min="1"
                  max="50"
                  value={tableRows}
                  onChange={e => setTableRows(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      editor.dispatchCommand(INSERT_TABLE_COMMAND, {
                        rows: tableRows,
                        columns: tableCols,
                        includeHeaders: tableIncludeHeader,
                      });
                      setIsTableModalOpen(false);
                    }
                  }}
                  aria-label="Number of rows"
                  aria-describedby="rows-help-text"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--app-surface-raised)',
                    border: '1px solid var(--app-border-subtle)',
                    color: 'var(--app-text-primary)',
                    outline: 'none',
                  }}
                />
                <p id="rows-help-text" className="text-[10px] mt-1" style={{ color: 'var(--app-text-muted)' }}>Max 50 rows</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--app-text-secondary)' }}>
                  Columns
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={tableCols}
                  onChange={e => setTableCols(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      editor.dispatchCommand(INSERT_TABLE_COMMAND, {
                        rows: tableRows,
                        columns: tableCols,
                        includeHeaders: tableIncludeHeader,
                      });
                      setIsTableModalOpen(false);
                    }
                  }}
                  aria-label="Number of columns"
                  aria-describedby="columns-help-text"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--app-surface-raised)',
                    border: '1px solid var(--app-border-subtle)',
                    color: 'var(--app-text-primary)',
                    outline: 'none',
                  }}
                />
                <p id="columns-help-text" className="text-[10px] mt-1" style={{ color: 'var(--app-text-muted)' }}>Max 10 columns</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={tableIncludeHeader}
                  onChange={e => setTableIncludeHeader(e.target.checked)}
                  className="rounded"
                />
                <span className="text-xs font-medium" style={{ color: 'var(--app-text-secondary)' }}>
                  Include header row (first row as table headers)
                </span>
              </label>
            </div>

            <p className="text-[10px] mb-4" style={{ color: 'var(--app-text-muted)' }}>
              Press Enter to insert, Escape to cancel.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setIsTableModalOpen(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors hover-btn"
                style={{
                  backgroundColor: 'var(--app-surface-raised)',
                  border: '1px solid var(--app-border-subtle)',
                  color: 'var(--app-text-secondary)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  editor.dispatchCommand(INSERT_TABLE_COMMAND, {
                    rows: tableRows,
                    columns: tableCols,
                    includeHeaders: tableIncludeHeader,
                  });
                  setIsTableModalOpen(false);
                }}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors"
              >
                Insert Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Mode accept/reject controls */}
      {editMode && (
        <div className="ml-auto flex items-center gap-1">
          <Tooltip content="Accept Edits">
            <button
              aria-label="Accept edits"
              onClick={onAcceptEdits}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors hover-accept"
              style={{ color: '#22c55e' }}
            >
              <Check className="w-3.5 h-3.5" />
              Accept
            </button>
          </Tooltip>
          <Tooltip content="Reject Edits">
            <button
              aria-label="Reject edits"
              onClick={onRejectEdits}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors hover-reject"
              style={{ color: '#ef4444' }}
            >
              <X className="w-3.5 h-3.5" />
              Reject
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
};
