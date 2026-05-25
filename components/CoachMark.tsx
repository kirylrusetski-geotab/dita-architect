import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const STORAGE_KEY = 'dita-architect-coach-sync-hint';

export const CoachMark = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== null) return;
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, []);

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
    localStorage.setItem(STORAGE_KEY, 'dismissed');
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
        Edit here or in the XML pane —{' '}
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
