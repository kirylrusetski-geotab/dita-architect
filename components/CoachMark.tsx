import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface CoachMarkProps {
  /** ADR-018: the settings store's `editor.showSyncHint` (Settings ▸ General can turn it back on). */
  show: boolean;
  /** Dismissing writes `showSyncHint: false`. */
  onDismiss: () => void;
}

export const CoachMark = ({ show, onDismiss }: CoachMarkProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) { setVisible(false); return; }
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, [show]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  const dismiss = () => {
    setVisible(false);
    onDismiss();
  };

  if (!visible) return null;

  return (
    <div
      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl shadow-lg"
      style={{
        backgroundColor: 'var(--app-surface-raised)',
        border: '1px solid var(--app-border)',
        color: 'var(--app-text-secondary)',
        fontSize: '12px',
        lineHeight: 1.4,
        maxWidth: 320,
        pointerEvents: 'auto',
      }}
    >
      <span>
        Edit here or in the XML split ({'⌘\\'} opens it). Press{' '}
        <kbd
          className="px-1 py-0.5 rounded text-[10px] font-mono font-semibold"
          style={{
            backgroundColor: 'var(--app-surface)',
            border: '1px solid var(--app-border)',
            color: 'var(--app-text-primary)',
          }}
        >
          Ctrl+Enter
        </kbd>{' '}
        to sync
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss hint"
        className="shrink-0 p-0.5 rounded transition-colors hover-app-text"
        style={{ color: 'var(--app-text-muted)' }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
