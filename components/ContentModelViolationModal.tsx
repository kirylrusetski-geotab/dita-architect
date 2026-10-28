import React from 'react';
import { Modal } from './Modal';
import { violationMessage, type ContentModelViolation } from '../lib/content-model-validate';

// FR-067 / ADR-014 decision 5: the blocking surface for handleHerettoSave,
// which has no existing feedback modal of its own (unlike Replace). No "Save
// anyway" — the content model has no severity tier, so every finding here is
// a hard block.

interface ContentModelViolationModalProps {
  violations: ContentModelViolation[];
  onClose: () => void;
}

export const ContentModelViolationModal = ({ violations, onClose }: ContentModelViolationModalProps) => (
  <Modal onClose={onClose} labelId="content-model-violation-title" className="rounded-xl p-6 w-[32rem] max-w-[95vw] shadow-2xl">
    <h3 id="content-model-violation-title" className="text-lg font-bold mb-1" style={{ color: 'var(--app-text-primary)' }}>
      Can't save — structural problems found
    </h3>
    <p className="text-sm mb-4" style={{ color: 'var(--app-text-muted)' }}>
      {violations.length === 1
        ? 'This topic has one place Heretto would reject. Fix it in the XML pane, then save again.'
        : `This topic has ${violations.length} places Heretto would reject. Fix them in the XML pane, then save again.`}
    </p>

    <ul className="max-h-64 overflow-y-auto rounded-lg mb-5" style={{ border: '1px solid var(--app-border-subtle)' }}>
      {violations.map((v, i) => (
        <li
          key={i}
          className="px-3 py-2 text-sm font-mono"
          style={{
            color: 'var(--app-text-primary)',
            borderTop: i === 0 ? undefined : '1px solid var(--app-border-subtle)',
          }}
        >
          {violationMessage(v)}
          <span className="ml-2 text-xs" style={{ color: 'var(--app-text-muted)' }}>
            line {v.line}, column {v.column}
          </span>
        </li>
      ))}
    </ul>

    <button
      autoFocus
      onClick={onClose}
      className="w-full py-2 rounded-lg text-sm font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors"
    >
      OK
    </button>
  </Modal>
);
