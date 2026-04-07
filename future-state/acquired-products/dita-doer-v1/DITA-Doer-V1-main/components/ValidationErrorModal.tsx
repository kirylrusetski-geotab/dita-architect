import React from 'react';

type ValidationResult = {
  isValid: boolean;
  topicType: 'concept' | 'reference' | 'task' | 'unknown' | 'error';
  errorDescription?: string;
  suggestedFix?: string;
}

interface ValidationErrorModalProps {
  error: ValidationResult;
  onClose: () => void;
  onApplyFix: (fix: string) => void;
}

const ValidationErrorModal: React.FC<ValidationErrorModalProps> = ({ error, onClose, onApplyFix }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl border border-red-500/50">
        <header className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-red-400">Validation Error</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </header>
        <div className="p-6 text-gray-300">
          <h3 className="font-semibold text-lg text-white mb-2">Description:</h3>
          <p className="bg-gray-900 p-3 rounded mb-4">{error.errorDescription || 'An unknown validation error occurred.'}</p>

          {error.suggestedFix && (
            <>
              <h3 className="font-semibold text-lg text-white mb-2">Suggested Fix:</h3>
              <div className="bg-gray-900 p-3 rounded max-h-60 overflow-y-auto">
                <pre className="text-sm text-gray-300 whitespace-pre-wrap"><code>{error.suggestedFix}</code></pre>
              </div>
            </>
          )}
        </div>
        <footer className="p-4 border-t border-gray-700 flex justify-end space-x-4">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
          {error.suggestedFix && (
            <button
              onClick={() => onApplyFix(error.suggestedFix!)}
              className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-colors font-semibold"
            >
              Apply Fix
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

export default ValidationErrorModal;
