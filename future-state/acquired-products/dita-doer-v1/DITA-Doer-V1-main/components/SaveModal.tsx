
import React, { useState, useEffect, useRef } from 'react';

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (filename: string) => void;
  fileType: 'dita' | 'xml' | 'txt';
}

const SaveModal: React.FC<SaveModalProps> = ({ isOpen, onClose, onSave, fileType }) => {
  const [filename, setFilename] = useState('content');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFilename('content');
      // Focus input after a brief delay to ensure modal is rendered
      setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  const handleSave = () => {
    const cleanName = filename.trim() || 'content';
    onSave(cleanName);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md border border-gray-700 transform transition-all scale-100">
        <header className="p-4 border-b border-gray-700 flex items-center justify-between bg-gray-800 rounded-t-lg">
          <h2 className="text-xl font-bold text-gray-100">Download File</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        
        <div className="p-6">
          <label htmlFor="filename" className="block text-sm font-medium text-gray-300 mb-2">
            Enter a name for your file
          </label>
          <div className="flex rounded-md shadow-sm">
            <input
              ref={inputRef}
              id="filename"
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="flex-1 min-w-0 block w-full px-4 py-2.5 rounded-l-md bg-gray-900 border border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm transition-colors outline-none"
              placeholder="filename"
            />
            <span className="inline-flex items-center px-4 py-2 rounded-r-md border border-l-0 border-gray-600 bg-gray-700 text-gray-300 font-mono text-sm">
              .{fileType}
            </span>
          </div>
        </div>
        
        <footer className="p-4 border-t border-gray-700 flex justify-end space-x-3 bg-gray-800/50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-900/50 text-sm font-medium flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </button>
        </footer>
      </div>
    </div>
  );
};

export default SaveModal;
