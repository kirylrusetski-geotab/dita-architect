import React from 'react';
import { Modal } from './Modal';

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmModal = ({ message, onConfirm, onClose }: ConfirmModalProps) => (
  <Modal onClose={onClose} labelId="confirm-modal-title" className="rounded-xl p-6 w-96 shadow-2xl">
    <h3 id="confirm-modal-title" className="text-lg font-bold mb-4" style={{ color: 'var(--app-text-primary)' }}>Confirm</h3>
    <p className="text-sm mb-6" style={{ color: 'var(--app-text-secondary)' }}>{message}</p>
    <div className="flex gap-2">
      <button
        onClick={onClose}
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
        onClick={onConfirm}
        className="flex-1 py-2 rounded-lg text-sm font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors"
      >
        Continue
      </button>
    </div>
  </Modal>
);
