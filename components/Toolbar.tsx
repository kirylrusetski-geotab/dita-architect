import React, { useState, useRef, useEffect, useContext } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  CLEAR_EDITOR_COMMAND,
  COMMAND_PRIORITY_EDITOR,
  $getSelection,
  $isRangeSelection,
} from 'lexical';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list';
// Import custom table command from main component
import {
  INSERT_TABLE_COMMAND,
  OPEN_INSERT_TABLE_MODAL_COMMAND,
  OPEN_INSERT_LINK_MODAL_COMMAND,
} from '../dita-architect';
import { $setBlocksType } from '@lexical/selection';
import { FileText, AlertTriangle, Heading1, Heading2, ListOrdered, List, Table, Undo, Redo, Trash2, Link, ChevronDown, Pencil, PenLine, Eye, Check, X, Tag, Braces } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip } from './Tooltip';
import type { DocumentMode } from '../types/tab';
import { ConfirmModal } from './ConfirmModal';
import { WRAP_INLINE_COMMAND, UNWRAP_INLINE_COMMAND, WRAP_SHORTCUTS } from './InlineWrapPlugin';
import { WRAP_TAGS, WRAP_TAG_LABELS, type WrapTag } from '../lib/inline-wrap';
import { KeyRegistryContext } from './KeyRegistryContext';
import { INSERT_VARIABLE_COMMAND } from './InsertVariablePlugin';
import { VariablePickerModal } from './VariablePickerModal';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
/** Shortcut hint for an inline element, from the plugin's single map. */
const shortcutHint = (tag: WrapTag): string | null => {
  const key = Object.keys(WRAP_SHORTCUTS).find(k => WRAP_SHORTCUTS[k] === tag);
  return key ? (IS_MAC ? `⌘⇧${key.toUpperCase()}` : `Ctrl+Shift+${key.toUpperCase()}`) : null;
};

const XREF_FORMATS: Array<[string, string]> = [['', 'Auto (from the URL)'], ['dita', 'dita'], ['ditamap', 'ditamap'], ['html', 'html'], ['pdf', 'pdf']];
const XREF_SCOPES: Array<[string, string]> = [['', 'Not set'], ['local', 'local'], ['peer', 'peer'], ['external', 'external']];

export const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'claude', label: 'Claude' },
  { value: 'nord', label: 'Nord' },
  { value: 'solarized', label: 'Solarized' },
  { value: 'navy', label: 'Navy' },
] as const;

export type ThemeName = typeof THEME_OPTIONS[number]['value'];

export const THEME_DESCRIPTIONS: Record<ThemeName, string> = {
  dark: 'High contrast for low-light work',
  light: 'Comfortable for extended daytime use',
  claude: 'Familiar Claude.ai colors',
  nord: 'Muted arctic palette for focus',
  solarized: 'Reduced eye strain color science',
  navy: 'Deep blue-navy palette for low-light work',
};

interface ToolbarProps {
  currentTheme: ThemeName;
  onThemeChange: (theme: ThemeName) => void;
  documentMode?: DocumentMode;
  onModeChange?: (mode: DocumentMode) => void;
  trackedChangeCount?: number;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
}

export const Toolbar = ({ currentTheme, onThemeChange, documentMode = 'editing', onModeChange, trackedChangeCount = 0, onAcceptAll, onRejectAll }: ToolbarProps) => {
  const [editor] = useLexicalComposerContext();
  // Content-mutating buttons are only live in editing mode: suggesting-mode
  // structural changes are untracked (FR-046 v1 blocks them), and viewing
  // mode is read-only.
  const editingDisabled = documentMode !== 'editing';
  const contentBtnClass = `p-1 rounded transition-colors hover-toolbar${editingDisabled ? ' opacity-40 pointer-events-none' : ''}`;
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');
  const [linkFormat, setLinkFormat] = useState('');
  const [linkScope, setLinkScope] = useState('');
  const [isInlineMenuOpen, setIsInlineMenuOpen] = useState(false);
  const inlineMenuRef = useRef<HTMLDivElement>(null);
  // FR-066: Insert Variable needs the connected map's registry.
  const keyRegistry = useContext(KeyRegistryContext);
  const [isVariablePickerOpen, setIsVariablePickerOpen] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tableIncludeHeader, setTableIncludeHeader] = useState(true);
  const tableRowsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsThemeOpen(false);
      }
      if (inlineMenuRef.current && !inlineMenuRef.current.contains(e.target as Node)) {
        setIsInlineMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const removeTableListener = editor.registerCommand(
      OPEN_INSERT_TABLE_MODAL_COMMAND,
      () => {
        setIsTableModalOpen(true);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
    const removeLinkListener = editor.registerCommand(
      OPEN_INSERT_LINK_MODAL_COMMAND,
      () => {
        openLinkModal();
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
    return () => {
      removeTableListener();
      removeLinkListener();
    };
  }, [editor]);

  // Insert Link is the <xref> wrap (ADR-010 slice B): it goes through
  // WRAP_INLINE_COMMAND so format/scope land in originMap and the wrap follows
  // the same refusal rules as every other inline element. Inside an existing
  // link it retargets that link instead (the previous TOGGLE_LINK behaviour).
  function openLinkModal() {
    setLinkUrl('');
    setLinkError('');
    setLinkFormat('');
    setLinkScope('');
    setIsLinkModalOpen(true);
    setTimeout(() => linkInputRef.current?.focus(), 0);
  }

  const submitLink = () => {
    const href = linkUrl.trim();
    if (!href) return;
    const lower = href.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
      setLinkError('Invalid URL scheme');
      return;
    }
    editor.dispatchCommand(WRAP_INLINE_COMMAND, {
      tag: 'xref',
      attrs: { href, format: linkFormat || undefined, scope: linkScope || undefined },
    });
    setIsLinkModalOpen(false);
  };

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
        <button aria-label="Heading 1" disabled={editingDisabled} onClick={() => formatHeading('h1')} className={contentBtnClass} style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <Heading1 className="w-4 h-4" />
        </button>
      </Tooltip>
      <Tooltip content="Heading 2">
        <button aria-label="Heading 2" disabled={editingDisabled} onClick={() => formatHeading('h2')} className={contentBtnClass} style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <Heading2 className="w-4 h-4" />
        </button>
      </Tooltip>
      <div className="w-px h-4 mx-2" style={{ backgroundColor: 'var(--editor-toolbar-divider)' }} />
      <Tooltip content="Bold">
        <button aria-label="Bold" disabled={editingDisabled} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')} className={contentBtnClass} style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <span className="font-bold font-serif">B</span>
        </button>
      </Tooltip>
      <Tooltip content="Italic">
        <button aria-label="Italic" disabled={editingDisabled} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')} className={contentBtnClass} style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <span className="italic font-serif">I</span>
        </button>
      </Tooltip>
      <div className="w-px h-4 mx-2" style={{ backgroundColor: 'var(--editor-toolbar-divider)' }} />
      <Tooltip content="Numbered List">
        <button aria-label="Numbered list" disabled={editingDisabled} onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)} className={contentBtnClass} style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <ListOrdered className="w-4 h-4" />
        </button>
      </Tooltip>
      <Tooltip content="Bulleted List">
        <button aria-label="Bulleted list" disabled={editingDisabled} onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)} className={contentBtnClass} style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <List className="w-4 h-4" />
        </button>
      </Tooltip>
      <Tooltip content="Insert Table">
        <button aria-label="Insert table" disabled={editingDisabled} onClick={() => {
          setTableRows(3);
          setTableCols(3);
          setTableIncludeHeader(true);
          setIsTableModalOpen(true);
          setTimeout(() => tableRowsInputRef.current?.focus(), 0);
        }} className={contentBtnClass} style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <Table className="w-4 h-4" />
        </button>
      </Tooltip>
      <div className="w-px h-4 mx-2" style={{ backgroundColor: 'var(--editor-toolbar-divider)' }} />
      <Tooltip content="Warning Note">
        <button aria-label="Warning note" disabled={editingDisabled} onClick={() => formatQuote()} className={contentBtnClass} style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <AlertTriangle className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
      <Tooltip content="Insert Link">
        <button aria-label="Insert link" disabled={editingDisabled} onClick={openLinkModal} className={contentBtnClass} style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <Link className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
      {/* ADR-010 slice B: wrap the selection in a DITA inline element. One menu,
          not seven buttons (Gate 7); xref reuses the Insert Link dialog. */}
      <div className="relative" ref={inlineMenuRef}>
        <Tooltip content="Inline element">
          <button
            aria-label="Inline element"
            aria-haspopup="true"
            aria-expanded={isInlineMenuOpen}
            disabled={editingDisabled}
            onMouseDown={e => e.preventDefault()}
            onClick={() => setIsInlineMenuOpen(prev => !prev)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!isInlineMenuOpen) setIsInlineMenuOpen(true);
                setTimeout(() => {
                  const first = inlineMenuRef.current?.querySelector('[role="menuitem"]') as HTMLElement | null;
                  first?.focus();
                }, 0);
              }
            }}
            className={`${contentBtnClass} flex items-center gap-0.5`}
            style={{ color: 'var(--editor-toolbar-text-strong)' }}
          >
            <Tag className="w-3.5 h-3.5" />
            <ChevronDown className={`w-3 h-3 transition-transform ${isInlineMenuOpen ? 'rotate-180' : ''}`} />
          </button>
        </Tooltip>
        {isInlineMenuOpen && (
          <div
            // Opens leftward from the button: the button sits near the visual
            // pane's right edge, and the pane clips overflow, so a left-anchored
            // menu lost its tag/shortcut column (seen in the v0.10.0 smoke).
            className="absolute top-full right-0 mt-1 rounded-lg shadow-xl border py-1 min-w-[230px] whitespace-nowrap"
            role="menu"
            aria-label="Inline element"
            onKeyDown={e => {
              const items = Array.from(inlineMenuRef.current?.querySelectorAll('[role="menuitem"]') ?? []) as HTMLElement[];
              const idx = items.indexOf(e.target as HTMLElement);
              if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length]?.focus(); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); }
              else if (e.key === 'Escape') { e.preventDefault(); setIsInlineMenuOpen(false); }
            }}
            style={{
              backgroundColor: 'var(--editor-toolbar-bg)',
              borderColor: 'var(--editor-toolbar-border)',
              // Above the editor and Heretto bar (z-10/z-20), below the theme
              // dropdown's reserved top layer and in the band other Toolbar
              // overlays use (tests/toolbar-z-index-fix.test.ts).
              zIndex: 200,
            }}
          >
            {WRAP_TAGS.map(tag => {
              const hint = shortcutHint(tag);
              return (
                <button
                  key={tag}
                  role="menuitem"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    setIsInlineMenuOpen(false);
                    if (tag === 'xref') openLinkModal();
                    else editor.dispatchCommand(WRAP_INLINE_COMMAND, { tag });
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-medium transition-colors flex items-center justify-between gap-3 hover-toolbar"
                  style={{ color: 'var(--editor-toolbar-text-strong)' }}
                >
                  <span>{WRAP_TAG_LABELS[tag]}{tag === 'xref' ? '…' : ''}</span>
                  <span className="flex items-center gap-2" style={{ color: 'var(--editor-toolbar-text)' }}>
                    <code>{`<${tag}>`}</code>
                    {hint && <span>{hint}</span>}
                  </span>
                </button>
              );
            })}
            <div className="my-1 h-px" style={{ backgroundColor: 'var(--editor-toolbar-divider)' }} />
            <button
              role="menuitem"
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                setIsInlineMenuOpen(false);
                editor.dispatchCommand(UNWRAP_INLINE_COMMAND, undefined);
              }}
              className="w-full text-left px-3 py-1.5 text-xs font-medium transition-colors hover-toolbar"
              style={{ color: 'var(--editor-toolbar-text-strong)' }}
            >
              Remove inline element
            </button>
          </div>
        )}
      </div>
      {/* FR-066: insert a variable from the connected map (ADR-013 decision 9). */}
      <Tooltip content={keyRegistry ? 'Insert variable' : 'Connect a map (Heretto ▸ Connect a Map…) to insert variables'}>
        <button
          aria-label="Insert variable"
          disabled={editingDisabled || !keyRegistry}
          onMouseDown={e => e.preventDefault()}
          onClick={() => setIsVariablePickerOpen(true)}
          className={`${contentBtnClass}${keyRegistry ? '' : ' opacity-40'}`}
          style={{ color: 'var(--editor-toolbar-text-strong)' }}
        >
          <Braces className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
      <div className="w-px h-4 mx-2" style={{ backgroundColor: 'var(--editor-toolbar-divider)' }} />
      <div
        className="flex items-center rounded"
        style={{ border: '1px solid var(--editor-toolbar-divider)' }}
        role="group"
        aria-label="Document mode"
      >
        <Tooltip content="Viewing — visual editor is read-only">
          <button
            aria-label="Viewing mode"
            aria-pressed={documentMode === 'viewing'}
            onClick={() => onModeChange?.('viewing')}
            className="p-1 rounded-l transition-colors hover-toolbar"
            style={{ color: 'var(--editor-toolbar-text-strong)', backgroundColor: documentMode === 'viewing' ? 'var(--editor-toolbar-divider)' : 'transparent' }}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
        <Tooltip content="Suggesting — edits become tracked changes">
          <button
            aria-label="Suggesting mode"
            aria-pressed={documentMode === 'suggesting'}
            onClick={() => onModeChange?.('suggesting')}
            className="p-1 transition-colors hover-toolbar"
            style={{ color: 'var(--editor-toolbar-text-strong)', backgroundColor: documentMode === 'suggesting' ? 'var(--editor-toolbar-divider)' : 'transparent' }}
          >
            <PenLine className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
        <Tooltip content="Editing — direct edits">
          <button
            aria-label="Editing mode"
            aria-pressed={documentMode === 'editing'}
            onClick={() => onModeChange?.('editing')}
            className="p-1 rounded-r transition-colors hover-toolbar"
            style={{ color: 'var(--editor-toolbar-text-strong)', backgroundColor: documentMode === 'editing' ? 'var(--editor-toolbar-divider)' : 'transparent' }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      </div>
      <div className="w-px h-4 mx-2" style={{ backgroundColor: 'var(--editor-toolbar-divider)' }} />
      <Tooltip content="Clear Contents">
        <button aria-label="Clear contents" disabled={editingDisabled} onClick={() => setIsClearConfirmOpen(true)} className={contentBtnClass} style={{ color: 'var(--editor-toolbar-text-strong)' }}>
          <Trash2 className="w-4 h-4" />
        </button>
      </Tooltip>
      {isClearConfirmOpen && (
        <ConfirmModal
          message="Clear all editor contents? This cannot be undone."
          onConfirm={() => {
            setIsClearConfirmOpen(false);
            editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
            toast('Cleared editor contents');
          }}
          onClose={() => setIsClearConfirmOpen(false)}
        />
      )}

      {/* Insert Variable picker (FR-066) */}
      {isVariablePickerOpen && keyRegistry && (
        <VariablePickerModal
          registry={keyRegistry}
          onInsert={entry => {
            setIsVariablePickerOpen(false);
            editor.dispatchCommand(INSERT_VARIABLE_COMMAND, { key: entry.key, id: entry.id, tag: entry.tag });
          }}
          onClose={() => setIsVariablePickerOpen(false)}
        />
      )}

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
                  submitLink();
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
            <div className="flex gap-3 mb-4">
              {([
                ['Format', 'link-format', linkFormat, setLinkFormat, XREF_FORMATS],
                ['Scope', 'link-scope', linkScope, setLinkScope, XREF_SCOPES],
              ] as const).map(([label, id, value, setValue, options]) => (
                <div key={id} className="flex-1">
                  <label htmlFor={id} className="block text-xs font-medium mb-1.5" style={{ color: 'var(--app-text-secondary)' }}>
                    {label}
                  </label>
                  <select
                    id={id}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg text-sm"
                    style={{
                      backgroundColor: 'var(--app-surface-raised)',
                      border: '1px solid var(--app-border-subtle)',
                      color: 'var(--app-text-primary)',
                      outline: 'none',
                    }}
                  >
                    {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
                  </select>
                </div>
              ))}
            </div>
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
                onClick={submitLink}
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

      {/* Suggesting-mode accept/reject-all controls */}
      {documentMode === 'suggesting' && trackedChangeCount > 0 && (
        <div className="ml-auto flex items-center gap-1">
          <span
            className="px-1.5 py-0.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: 'var(--editor-toolbar-divider)', color: 'var(--editor-toolbar-text-strong)' }}
            aria-label={`${trackedChangeCount} tracked changes`}
          >
            {trackedChangeCount}
          </span>
          <Tooltip content="Accept all tracked changes">
            <button
              aria-label="Accept all changes"
              onClick={onAcceptAll}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors hover-accept"
              style={{ color: '#22c55e' }}
            >
              <Check className="w-3.5 h-3.5" />
              Accept All
            </button>
          </Tooltip>
          <Tooltip content="Reject all tracked changes">
            <button
              aria-label="Reject all changes"
              onClick={onRejectAll}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors hover-reject"
              style={{ color: '#ef4444' }}
            >
              <X className="w-3.5 h-3.5" />
              Reject All
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
};
