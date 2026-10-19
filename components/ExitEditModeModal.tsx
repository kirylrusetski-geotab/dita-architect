import React from 'react';
import { Modal } from './Modal';

interface ExitEditModeModalProps {
  changeCount?: number;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
}

export const ExitEditModeModal = ({ changeCount = 0, onAccept, onReject, onCancel }: ExitEditModeModalProps) => {
  return (
    <Modal onClose={onCancel} labelId="exit-edit-mode-title" className="rounded-xl p-6 shadow-2xl" style={{ width: '440px' }}>
        <h3
          id="exit-edit-mode-title"
          className="text-lg font-bold mb-2"
          style={{ color: 'var(--app-text-primary)' }}
        >
          Exit Suggesting Mode
        </h3>
        <p className="text-sm mb-6" style={{ color: 'var(--app-text-secondary)' }}>
          {changeCount > 0
            ? `You have ${changeCount} unresolved tracked ${changeCount === 1 ? 'change' : 'changes'}. What would you like to do before exiting?`
            : 'You have unresolved tracked changes. What would you like to do before exiting?'}
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
    </Modal>
  );
};
