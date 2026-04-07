import React from 'react';
import Dropdown from './Dropdown';
import { FileIcon, FormatIcon, QuickActionIcon, ValidateIcon, PreviewIcon, SaveAsIcon, CutIcon, CopyIcon, PasteIcon, PasteOverwriteIcon, ClearIcon, SearchIcon, UndoIcon, RedoIcon, DitaIcon, XmlFileIcon, TxtIcon, CheckIcon, XIcon, PencilIcon, SpinnerIcon } from './icons';

interface ToolbarProps {
  onFileAction: (action: 'cut' | 'copy' | 'paste' | 'paste-overwrite' | 'clear') => void;
  onFormat: (formatType: 'Concept' | 'Reference' | 'Task') => void;
  onQuickAction: (action: 'find' | 'undo' | 'redo') => void;
  onDownload: (fileType: 'dita' | 'xml' | 'txt') => void;
  onValidate: () => void;
  onPreview: () => void;
  
  // Review Mode Props
  onAccept: () => void;
  onReject: () => void;
  onManualModify: () => void;
  isReviewing: boolean;
  isManualEditing: boolean;
  
  validationStatus: string;
  isValidating?: boolean;
  validatedTopicType?: string | null;
  isProcessing: boolean;
  disabled?: boolean;
}

const ToolbarButton: React.FC<{ onClick?: () => void, children: React.ReactNode, disabled?: boolean, className?: string, title?: string }> = ({ onClick, children, disabled, className, title }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`flex items-center space-x-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${className ? className : 'text-gray-300 bg-gray-700/50 hover:bg-gray-700'}`}
    >
        {children}
    </button>
);

const Toolbar: React.FC<ToolbarProps> = ({ 
  onFileAction, 
  onFormat, 
  onQuickAction, 
  onDownload, 
  onValidate, 
  onPreview, 
  
  onAccept,
  onReject,
  onManualModify,
  isReviewing,
  isManualEditing,

  validationStatus, 
  isValidating,
  validatedTopicType,
  isProcessing,
  disabled
}) => {
  return (
    <div className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-700/50 px-4 py-2 flex items-center space-x-2 z-10">
      
      {/* Standard Toolbar Actions - Disabled during review */}
      <div className={`flex items-center space-x-2 transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        
        <Dropdown
          label="File"
          icon={<FileIcon />}
          items={[
            { label: 'Cut', icon: <CutIcon />, action: () => onFileAction('cut'), feedbackLabel: 'Cut to Clipboard!' },
            { label: 'Copy', icon: <CopyIcon />, action: () => onFileAction('copy'), feedbackLabel: 'Copied!' },
            { label: 'Paste', icon: <PasteIcon />, action: () => onFileAction('paste'), feedbackLabel: 'Pasted from Clipboard!' },
            { label: 'Paste & Overwrite', icon: <PasteOverwriteIcon />, action: () => onFileAction('paste-overwrite'), feedbackLabel: 'Replaced Content!' },
            { type: 'divider' },
            { label: 'Clear Contents', icon: <ClearIcon />, action: () => onFileAction('clear'), feedbackLabel: 'Contents Cleared!' },
          ]}
        />
        <Dropdown
          label="Format"
          icon={<FormatIcon />}
          items={[
            { label: 'Format as Concept topic', action: () => onFormat('Concept') },
            { label: 'Format as Reference topic', action: () => onFormat('Reference') },
            { label: 'Format as Task topic', action: () => onFormat('Task') },
          ]}
        />
        <Dropdown
          label="Quick Actions"
          icon={<QuickActionIcon />}
          items={[
            { label: 'Find & Replace', icon: <SearchIcon />, action: () => onQuickAction('find') },
            { type: 'divider' },
            { label: 'Undo', icon: <UndoIcon />, action: () => onQuickAction('undo') },
            { label: 'Redo', icon: <RedoIcon />, action: () => onQuickAction('redo') },
          ]}
        />
        
        <div className="w-px h-6 bg-gray-600 mx-2" />
        
        <ToolbarButton 
            onClick={onValidate} 
            disabled={isProcessing}
            className={
                isValidating 
                    ? "text-gray-200 bg-gray-700/50 cursor-wait" 
                    : validatedTopicType 
                        ? "bg-green-600 hover:bg-green-500 text-white shadow-sm ring-1 ring-green-500/50" 
                        : undefined
            }
        >
          {isValidating ? (
              <>
                <SpinnerIcon className="animate-spin h-4 w-4" />
                <span>Validating...</span>
              </>
          ) : validatedTopicType ? (
              <>
                <CheckIcon />
                <span>Validated as {validatedTopicType}</span>
              </>
          ) : (
              <>
                <ValidateIcon />
                <span>Validate</span>
              </>
          )}
        </ToolbarButton>
        
        <ToolbarButton onClick={onPreview} disabled={isProcessing}>
          <PreviewIcon />
          <span>Preview</span>
        </ToolbarButton>

        <Dropdown
          label="Download"
          icon={<SaveAsIcon />}
          items={[
            { label: '.dita File', icon: <DitaIcon />, action: () => onDownload('dita') },
            { label: '.xml File', icon: <XmlFileIcon />, action: () => onDownload('xml') },
            { label: '.txt File', icon: <TxtIcon />, action: () => onDownload('txt') },
          ]}
        />
      </div>

      <div className="flex-grow" />

      {/* Right side: Status and Review Buttons */}
      <div className="flex items-center space-x-3">
        {/* Status Text */}
        <div className="flex items-center space-x-2 text-sm text-gray-400">
          {isProcessing ? (
              <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-cyan-400"></div>
                  <span>Processing...</span>
              </>
          ) : (
              <span>{validationStatus}</span>
          )}
        </div>

        {/* Review Action Buttons - Only visible during review */}
        {isReviewing && (
          <div className="flex items-center space-x-2 pl-3 border-l border-gray-600 animate-fadeIn">
            <ToolbarButton 
              onClick={onAccept} 
              className="bg-green-600 hover:bg-green-500 text-white shadow-sm ring-1 ring-green-500/50"
              title="Accept Changes"
            >
              <CheckIcon />
              <span>Accept</span>
            </ToolbarButton>

            <ToolbarButton 
              onClick={onReject} 
              className="bg-red-600 hover:bg-red-500 text-white shadow-sm ring-1 ring-red-500/50"
              title="Reject Changes"
            >
              <XIcon />
              <span>Reject</span>
            </ToolbarButton>

            <ToolbarButton 
              onClick={onManualModify} 
              className={`${
                isManualEditing 
                  ? 'bg-blue-600 text-white ring-2 ring-blue-400' 
                  : 'bg-gray-600 hover:bg-gray-500 text-white ring-1 ring-gray-500/50'
              } shadow-sm`}
              title="Modify Changes Manually"
            >
              <PencilIcon />
              <span>{isManualEditing ? 'Editing...' : 'Modify'}</span>
            </ToolbarButton>
          </div>
        )}
      </div>
    </div>
  );
};

export default Toolbar;