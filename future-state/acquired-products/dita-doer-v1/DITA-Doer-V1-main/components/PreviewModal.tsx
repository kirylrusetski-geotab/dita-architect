import React from 'react';

interface PreviewModalProps {
  htmlContent: string;
  onClose: () => void;
}

const PreviewModal: React.FC<PreviewModalProps> = ({ htmlContent, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-4/5 flex flex-col">
        <header className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 rounded-t-lg">
          <h2 className="text-xl font-bold text-gray-800">Content Preview</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button>
        </header>
        <div className="p-6 flex-grow overflow-y-auto">
          <div 
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
        <footer className="p-4 border-t border-gray-200 flex justify-end bg-gray-50 rounded-b-lg">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};

export default PreviewModal;
