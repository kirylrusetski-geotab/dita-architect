import React, { useEffect } from 'react';

interface ExitEditModeModalProps {
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
}

export const ExitEditModeModal = ({ onAccept, onReject, onCancel }: ExitEditModeModalProps) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-edit-mode-title"
        className="rounded-xl p-6 shadow-2xl"
        style={{
          width: '440px',
          backgroundColor: 'var(--app-surface)',
          border: '1px solid var(--app-border-subtle)',
        }}
      >
        <h3
          id="exit-edit-mode-title"
          className="text-lg font-bold mb-2"
          style={{ color: 'var(--app-text-primary)' }}
        >
          Exit Edit Mode
        </h3>
        <p className="text-sm mb-6" style={{ color: 'var(--app-text-secondary)' }}>
          You have tracked changes. What would you like to do before exiting?
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
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
            onClick={onReject}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--app-surface-raised)',
              border: '1px solid var(--app-border-subtle)',
              color: '#f87171',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(248,113,113,0.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--app-surface-raised)'; }}
          >
            Reject All
          </button>
          <button
            onClick={onAccept}
            className="flex-1 py-2 rounded-lg text-sm font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
};
