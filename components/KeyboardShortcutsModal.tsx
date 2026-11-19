import React from 'react';
import { Keyboard } from 'lucide-react';
import { ShortcutList } from './ShortcutList';
import { Modal } from './Modal';

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

export const KeyboardShortcutsModal = ({ onClose }: KeyboardShortcutsModalProps) => {
  return (
    <Modal onClose={onClose} labelId="keyboard-shortcuts-title" className="rounded-xl p-6 w-[480px] max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-dita-500 to-dita-600 flex items-center justify-center shadow-lg shadow-dita-500/20">
            <Keyboard className="text-white w-4 h-4" />
          </div>
          <div>
            <h3 id="keyboard-shortcuts-title" className="text-base font-bold" style={{ color: 'var(--app-text-primary)' }}>
              Keyboard Shortcuts
            </h3>
            <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>DITA Architect</p>
          </div>
        </div>

        {/* Shortcut list (shared with Settings ▸ Keyboard Shortcuts, ADR-018) */}
        <div className="flex-1 overflow-y-auto pr-1">
          <ShortcutList />
        </div>

        {/* Footer */}
        <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--app-border-subtle)' }}>
          <button
            autoFocus
            onClick={onClose}
            className="w-full py-2 rounded-lg text-sm font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors"
          >
            Close
          </button>
        </div>
    </Modal>
  );
};
