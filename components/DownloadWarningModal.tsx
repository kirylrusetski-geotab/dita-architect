import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface DownloadWarningModalProps {
  onCancel: () => void;
  onContinue: () => void;
}

const DownloadWarningModal: React.FC<DownloadWarningModalProps> = ({ onCancel, onContinue }) => {
  return (
    <Modal onClose={onCancel} labelId="download-warning-title" className="rounded-xl shadow-2xl w-full max-w-md transform transition-all scale-100">
      <header
        className="p-4 border-b rounded-t-xl flex items-center justify-between"
        style={{
          borderBottomColor: 'var(--app-border-subtle)',
          backgroundColor: 'var(--app-surface)',
        }}
      >
        <h2
          id="download-warning-title"
          className="text-xl font-bold flex items-center"
          style={{ color: 'var(--app-text-warning)' }}
        >
          <AlertTriangle className="h-6 w-6 mr-2" />
          Unvalidated File
        </h2>
      </header>

      <div className="p-6">
        <p
          className="mb-4 font-medium"
          style={{ color: 'var(--app-text-primary)' }}
        >
          This file has not been validated.
        </p>
        <p
          className="text-sm leading-relaxed"
          style={{ color: 'var(--app-text-secondary)' }}
        >
          It may not load as a valid DITA file in Heretto or other content management systems. We recommend validating the content before downloading to ensure compatibility.
        </p>
      </div>

      <footer
        className="p-4 border-t rounded-b-xl flex justify-end space-x-3"
        style={{
          borderTopColor: 'var(--app-border-subtle)',
          backgroundColor: 'var(--app-surface-raised)',
        }}
      >
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover-btn"
          style={{
            backgroundColor: 'var(--app-surface-raised)',
            border: '1px solid var(--app-border-subtle)',
            color: 'var(--app-text-secondary)',
          }}
        >
          Return to Editor
        </button>
        <button
          onClick={onContinue}
          className="px-4 py-2 bg-dita-600 text-white rounded-md hover:bg-dita-500 transition-colors shadow-lg text-sm font-medium"
        >
          Download Anyway
        </button>
      </footer>
    </Modal>
  );
};

export default DownloadWarningModal;
