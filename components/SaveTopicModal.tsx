import React from 'react';
import { Modal } from './Modal';

interface SaveTopicModalProps {
  saveFileName: string;
  setSaveFileName: (name: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export const SaveTopicModal = ({ saveFileName, setSaveFileName, onSave, onClose }: SaveTopicModalProps) => (
  <Modal onClose={onClose} labelId="save-topic-title" className="rounded-xl p-6 w-96 shadow-2xl">
      <h3 id="save-topic-title" className="text-lg font-bold mb-1" style={{ color: 'var(--app-text-primary)' }}>Save Topic</h3>
      <p className="text-sm mb-5" style={{ color: 'var(--app-text-muted)' }}>
        Confirm the file name, then pick where to save it.
      </p>

      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--app-text-secondary)' }}>
        File name
      </label>
      <input
        type="text"
        value={saveFileName}
        onChange={e => setSaveFileName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSave(); }}
        autoFocus
        className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none mb-1"
        style={{
          backgroundColor: 'var(--app-surface-raised)',
          border: '1px solid var(--app-border-subtle)',
          color: 'var(--app-text-primary)',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'var(--editor-accent)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'var(--app-border-subtle)')}
      />
      <p className="text-[10px] mb-5" style={{ color: 'var(--app-text-muted)' }}>
        .dita extension will be added automatically if not provided.
      </p>

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
          onClick={onSave}
          className="flex-1 py-2 rounded-lg text-sm font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors"
        >
          Save
        </button>
      </div>
  </Modal>
);
