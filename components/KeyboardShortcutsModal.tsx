import React from 'react';
import { Keyboard } from 'lucide-react';
import { KEYBOARD_SHORTCUTS } from '../constants/keyboard-shortcuts';
import { Modal } from './Modal';

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

export const KeyboardShortcutsModal = ({ onClose }: KeyboardShortcutsModalProps) => {
  const categories = Array.from(new Set(KEYBOARD_SHORTCUTS.map(s => s.category)));

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

        {/* Shortcut list */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {categories.map(category => (
            <div key={category}>
              <h4
                className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'var(--app-text-muted)' }}
              >
                {category}
              </h4>
              <div className="space-y-1.5">
                {KEYBOARD_SHORTCUTS.filter(s => s.category === category).map((shortcut, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-4 px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--app-surface-raised)' }}
                  >
                    <span style={{ color: 'var(--app-text-secondary)' }}>{shortcut.description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {shortcut.keys.map((key, ki) => (
                        <React.Fragment key={ki}>
                          {ki > 0 && (
                            <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>or</span>
                          )}
                          <kbd
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold"
                            style={{
                              backgroundColor: 'var(--app-surface)',
                              border: '1px solid var(--app-border)',
                              color: 'var(--app-text-primary)',
                            }}
                          >
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
