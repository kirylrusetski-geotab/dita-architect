// FR-046 — the tracked-changes sidebar (Word-style review pane).
//
// Docked over the right edge of the visual editor pane while suggesting mode
// has unresolved changes. One row per logical change (grouped by changeId via
// $scanTrackedChanges — identity is never a Lexical node key). Row click
// scrolls the first mark into view; per-row Accept/Reject are atomic model
// mutations. Accept All / Reject All stay in the Toolbar — one surface each.
import React, { useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { Check, X, ChevronDown, ChevronUp, Plus, Minus, Pilcrow } from 'lucide-react';
import { $scanTrackedChanges } from '../lib/tracked-changes/scan';
import { $acceptChange, $rejectChange } from '../lib/tracked-changes/mutations';
import type { Change } from '../lib/tracked-changes/model';
import type { DocumentMode } from '../types/tab';

interface ChangeListPanelProps {
  documentMode: DocumentMode;
}

const kindIcon = (kind: Change['kind']) => {
  switch (kind) {
    case 'insert':
      return <Plus className="w-3 h-3" style={{ color: '#22c55e' }} />;
    case 'delete':
      return <Minus className="w-3 h-3" style={{ color: '#ef4444' }} />;
    default:
      return <Pilcrow className="w-3 h-3" style={{ color: '#22c55e' }} />;
  }
};

const kindLabel = (kind: Change['kind']) =>
  kind === 'insert' ? 'Inserted' : kind === 'delete' ? 'Deleted' : 'Paragraph split';

const changesSignature = (changes: Change[]): string =>
  changes.map(c => `${c.changeId}\0${c.kind}\0${c.text}`).join('\n');

export const ChangeListPanel = ({ documentMode }: ChangeListPanelProps) => {
  const [editor] = useLexicalComposerContext();
  const [changes, setChanges] = useState<Change[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const signatureRef = useRef('');

  useEffect(() => {
    if (documentMode !== 'suggesting') {
      signatureRef.current = '';
      setChanges([]);
      return;
    }
    const refresh = () => {
      const next = editor.getEditorState().read(() => $scanTrackedChanges());
      const sig = changesSignature(next);
      if (sig !== signatureRef.current) {
        signatureRef.current = sig;
        setChanges(next);
      }
    };
    refresh();
    return editor.registerUpdateListener(refresh);
  }, [editor, documentMode]);

  if (documentMode !== 'suggesting' || changes.length === 0) return null;

  const scrollToChange = (change: Change) => {
    const dom = editor.getElementByKey(change.firstNodeKey);
    dom?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const accept = (change: Change) => {
    editor.update(() => $acceptChange(change.changeId), { discrete: true });
  };

  const reject = (change: Change) => {
    editor.update(() => $rejectChange(change.changeId), { discrete: true });
  };

  return (
    <div
      className="absolute right-3 z-30 flex flex-col rounded-lg shadow-xl overflow-hidden"
      style={{
        top: '5.5rem',
        maxHeight: 'calc(100% - 9rem)',
        width: '260px',
        backgroundColor: 'var(--app-surface)',
        border: '1px solid var(--app-border-subtle)',
      }}
      role="region"
      aria-label="Tracked changes"
    >
      <button
        onClick={() => setCollapsed(prev => !prev)}
        className="flex items-center justify-between px-3 py-2 text-xs font-semibold"
        style={{ color: 'var(--app-text-primary)', backgroundColor: 'var(--app-surface-raised)' }}
        aria-expanded={!collapsed}
      >
        <span>Tracked changes ({changes.length})</span>
        {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>
      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          {changes.map(change => (
            <div
              key={change.changeId}
              className="px-3 py-2 border-t cursor-pointer transition-colors hover-btn"
              style={{ borderColor: 'var(--app-border-subtle)' }}
              onClick={() => scrollToChange(change)}
              role="button"
              aria-label={`${kindLabel(change.kind)}: ${change.text || 'paragraph split'}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {kindIcon(change.kind)}
                <span className="text-[11px] font-medium" style={{ color: 'var(--app-text-secondary)' }}>
                  {kindLabel(change.kind)}
                </span>
                <span className="text-[10px] ml-auto" style={{ color: 'var(--app-text-muted)' }}>
                  {change.author} · {new Date(change.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {change.text && (
                <div
                  className="text-xs mb-1.5 break-words"
                  style={{
                    color: 'var(--app-text-primary)',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textDecoration: change.kind === 'delete' ? 'line-through' : undefined,
                  }}
                >
                  {change.text}
                </div>
              )}
              <div className="flex items-center gap-1">
                <button
                  aria-label="Accept this change"
                  onClick={e => {
                    e.stopPropagation();
                    accept(change);
                  }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors hover-accept"
                  style={{ color: '#22c55e' }}
                >
                  <Check className="w-3 h-3" />
                  Accept
                </button>
                <button
                  aria-label="Reject this change"
                  onClick={e => {
                    e.stopPropagation();
                    reject(change);
                  }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors hover-reject"
                  style={{ color: '#ef4444' }}
                >
                  <X className="w-3 h-3" />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
