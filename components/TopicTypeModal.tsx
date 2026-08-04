import React from 'react';
import { CheckCircle } from 'lucide-react';
import { Modal } from './Modal';

interface TopicTypeModalProps {
  title: string;
  description: string;
  onSelect: (type: 'task' | 'concept' | 'reference') => void;
  onClose: () => void;
  disabledType?: string;
}

export const TopicTypeModal = ({ title, description, onSelect, onClose, disabledType }: TopicTypeModalProps) => (
  <Modal onClose={onClose} labelId="topic-type-modal-title" className="rounded-xl p-6 w-96 shadow-2xl">
    <h3 id="topic-type-modal-title" className="text-lg font-bold mb-4" style={{ color: 'var(--app-text-primary)' }}>{title}</h3>
    <p className="text-sm mb-6" style={{ color: 'var(--app-text-muted)' }}>{description}</p>
    <div className="space-y-2">
      {(['task', 'concept', 'reference'] as const).map((type) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          disabled={disabledType === type}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all"
          style={{
            backgroundColor: 'var(--app-surface-raised)',
            border: '1px solid var(--app-border-subtle)',
            color: disabledType === type ? 'var(--app-text-muted)' : 'var(--app-text-secondary)',
            cursor: disabledType === type ? 'not-allowed' : 'pointer',
            opacity: disabledType === type ? 0.6 : 1,
          }}
          onMouseEnter={e => {
            if (disabledType !== type) {
              e.currentTarget.style.backgroundColor = 'var(--app-btn-hover)';
              e.currentTarget.style.color = 'var(--app-text-primary)';
            }
          }}
          onMouseLeave={e => {
            if (disabledType !== type) {
              e.currentTarget.style.backgroundColor = 'var(--app-surface-raised)';
              e.currentTarget.style.color = 'var(--app-text-secondary)';
            }
          }}
        >
          <span className="capitalize font-medium">{type}</span>
          {disabledType === type && <CheckCircle className="w-4 h-4" />}
        </button>
      ))}
    </div>
    <button
      onClick={onClose}
      className="mt-6 w-full py-2 text-sm transition-colors hover-text"
      style={{ color: 'var(--app-text-muted)' }}
    >
      Cancel
    </button>
  </Modal>
);
