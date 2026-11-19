import React from 'react';
import { KEYBOARD_SHORTCUTS } from '../constants/keyboard-shortcuts';

/**
 * The cheat sheet's list, by category: the one rendering of
 * constants/keyboard-shortcuts.ts, used by the ⌘/ modal and by Settings ▸
 * Keyboard Shortcuts (ADR-018 decision 9).
 */
export const ShortcutList = () => {
  const categories = Array.from(new Set(KEYBOARD_SHORTCUTS.map(s => s.category)));
  return (
    <div className="space-y-4">
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
  );
};
