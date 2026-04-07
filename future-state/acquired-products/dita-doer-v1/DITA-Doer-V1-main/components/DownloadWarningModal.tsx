
import React from 'react';

interface DownloadWarningModalProps {
  onCancel: () => void;
  onContinue: () => void;
}

const DownloadWarningModal: React.FC<DownloadWarningModalProps> = ({ onCancel, onContinue }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] animate-fadeIn">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md border border-yellow-600/50 transform transition-all scale-100">
        <header className="p-4 border-b border-gray-700 flex items-center justify-between bg-gray-800 rounded-t-lg">
          <h2 className="text-xl font-bold text-yellow-500 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Unvalidated File
          </h2>
        </header>
        
        <div className="p-6">
          <p className="text-gray-300 mb-4 font-medium">
            This file has not been validated.
          </p>
          <p className="text-gray-400 text-sm leading-relaxed">
            It may not load as a valid DITA file in Heretto or other content management systems. We recommend validating the content before downloading to ensure compatibility.
          </p>
        </div>
        
        <footer className="p-4 border-t border-gray-700 flex justify-end space-x-3 bg-gray-800/50 rounded-b-lg">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Return to Editor
          </button>
          <button
            onClick={onContinue}
            className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-500 transition-colors shadow-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-yellow-500"
          >
            Download Anyway
          </button>
        </footer>
      </div>
    </div>
  );
};

export default DownloadWarningModal;
