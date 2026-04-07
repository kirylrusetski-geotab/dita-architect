
import React, { useRef, useEffect, useState } from 'react';
import '../types'; // Ensures global types are loaded

interface EditorProps {
  value: string;
  proposedValue?: string;
  isReviewMode?: boolean;
  isDiffReadOnly?: boolean;
  onChange: (newValue: string) => void;
  onProposedChange?: (newValue: string) => void;
  onMount: (editor: any) => void;
}

const LoadingSpinner: React.FC = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-50">
    <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400 mb-4"></div>
        <p className="text-gray-400 text-sm font-medium animate-pulse">Initializing Editor...</p>
    </div>
  </div>
);

const Editor: React.FC<EditorProps> = ({ 
  value, 
  proposedValue, 
  isReviewMode, 
  isDiffReadOnly = true,
  onChange, 
  onProposedChange,
  onMount 
}) => {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<any>(null);
  const diffEditorInstanceRef = useRef<any>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const onChangeRef = useRef(onChange);
  const onProposedChangeRef = useRef(onProposedChange);
  const onMountRef = useRef(onMount);

  // Keep callbacks fresh
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  
  useEffect(() => {
    onProposedChangeRef.current = onProposedChange;
  }, [onProposedChange]);
  
  useEffect(() => {
    onMountRef.current = onMount;
  }, [onMount]);

  const destroyEditors = () => {
    if (editorInstanceRef.current) {
      editorInstanceRef.current.dispose();
      editorInstanceRef.current = null;
    }
    if (diffEditorInstanceRef.current) {
      diffEditorInstanceRef.current.dispose();
      diffEditorInstanceRef.current = null;
    }
  };

  useEffect(() => {
    let isUnmounted = false;

    const initEditor = () => {
      if (!editorContainerRef.current || !window.monaco) return;
      
      // Define a custom theme for review mode with VERY visible colors
      // We wrap in try-catch or check just in case, though defineTheme is usually safe to overwrite
      try {
        window.monaco.editor.defineTheme('review-theme', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#111827', // bg-gray-900
                
                // Insertions (Right Side) - Green
                // Text background: Highly visible green (approx 40% opacity)
                'diffEditor.insertedTextBackground': '#22c55e66', 
                // Line background: Subtle green tint (approx 20% opacity)
                'diffEditor.insertedLineBackground': '#22c55e33',
                
                // Deletions (Left Side) - Red
                'diffEditor.removedTextBackground': '#ef444466',
                'diffEditor.removedLineBackground': '#ef444433',
                
                // Gutters - Solid colors
                'diffEditorGutter.insertedLineBackground': '#22c55e', 
                'diffEditorGutter.removedLineBackground': '#ef4444',
                
                'diffEditor.diagonalFill': '#374151',
            }
        });
      } catch (e) {
          console.warn("Could not define review-theme", e);
      }
      
      destroyEditors();

      if (isReviewMode && proposedValue !== undefined) {
        // Explicitly set the theme to ensure it applies globally before creation
        window.monaco.editor.setTheme('review-theme');

        // Create Diff Editor
        const diffEditor = window.monaco.editor.createDiffEditor(editorContainerRef.current, {
          theme: 'review-theme',
          automaticLayout: true,
          fontSize: 14,
          originalEditable: false,
          readOnly: isDiffReadOnly, // Controlled by prop
          renderSideBySide: true,
          diffWordWrap: 'on',
          renderIndicators: true,
          useInlineViewWhenSpaceIsLimited: false,
          ignoreTrimWhitespace: false,
          renderOverviewRuler: true,
          diffCodeLens: true,
          padding: { top: 16, bottom: 16 },
        });

        const originalModel = window.monaco.editor.createModel(value, 'xml');
        const modifiedModel = window.monaco.editor.createModel(proposedValue, 'xml');

        diffEditor.setModel({
          original: originalModel,
          modified: modifiedModel
        });
        
        // Listen for manual edits on the modified side
        modifiedModel.onDidChangeContent(() => {
            const val = modifiedModel.getValue();
            if (onProposedChangeRef.current) {
                onProposedChangeRef.current(val);
            }
        });

        diffEditorInstanceRef.current = diffEditor;
      } else {
        // Reset to standard theme for normal editing
        window.monaco.editor.setTheme('vs-dark');

        // Create Standard Editor
        const editor = window.monaco.editor.create(editorContainerRef.current, {
          value: value,
          language: 'xml',
          theme: 'vs-dark',
          automaticLayout: true,
          fontSize: 14,
          minimap: { enabled: true },
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          roundedSelection: false,
          glyphMargin: true,
          lineNumbersMinChars: 3,
          padding: { top: 16, bottom: 16 }
        });

        editor.onDidChangeModelContent(() => {
          const currentValue = editor.getValue();
          if (currentValue !== value) {
            onChangeRef.current(currentValue);
          }
        });

        editorInstanceRef.current = editor;
        onMountRef.current(editor);
      }
      setIsEditorReady(true);
    };

    // Ensure Monaco is loaded before initializing
    if (window.monaco) {
        initEditor();
    } else {
        window.require(['vs/editor/editor.main'], () => {
        if (isUnmounted) return;
        initEditor();
        });
    }

    return () => {
      isUnmounted = true;
      destroyEditors();
    };
  }, [isReviewMode, proposedValue]); // Re-init if mode or initial proposed value changes severely

  // Handle readOnly updates dynamically for Diff Editor
  useEffect(() => {
      if (diffEditorInstanceRef.current && isReviewMode) {
          diffEditorInstanceRef.current.updateOptions({
              readOnly: isDiffReadOnly
          });
      }
  }, [isDiffReadOnly, isReviewMode]);

  // Sync value to standard editor if it's not in review mode
  useEffect(() => {
    if (!isReviewMode && editorInstanceRef.current && editorInstanceRef.current.getValue() !== value) {
      const viewState = editorInstanceRef.current.saveViewState();
      editorInstanceRef.current.setValue(value);
      if(viewState) {
        editorInstanceRef.current.restoreViewState(viewState);
      }
    }
  }, [value, isReviewMode]);

  return (
    <div className="w-full h-full relative group">
      {/* Override Monaco Find Widget Position and Styling */}
      <style>{`
        .monaco-editor .find-widget {
          right: auto !important;
          left: 10px !important;
          top: 10px !important;
          border-radius: 6px;
          border: 1px solid #4b5563 !important; /* gray-600 */
          background-color: #1f2937 !important; /* gray-800 */
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
        }
        
        .monaco-editor .find-widget .monaco-inputbox {
           background-color: #111827 !important; /* gray-900 */
           color: #e5e7eb !important; /* gray-200 */
           border: 1px solid #374151 !important; /* gray-700 */
        }
        
        .monaco-editor .find-widget .button {
           color: #9ca3af !important; /* gray-400 */
        }
        .monaco-editor .find-widget .button:hover {
           background-color: #374151 !important; /* gray-700 */
           color: #ffffff !important;
        }
      `}</style>

      {!isEditorReady && <LoadingSpinner />}
      <div 
        ref={editorContainerRef} 
        className={`w-full h-full transition-opacity duration-500 ${isEditorReady ? 'opacity-100' : 'opacity-0'}`} 
      />
    </div>
  );
};

export default Editor;
