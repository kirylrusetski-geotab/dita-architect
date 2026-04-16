import React, { useRef, useEffect, useState } from 'react';
import { Monaco } from '@monaco-editor/react';
import { loader } from '@monaco-editor/react';

interface DiffViewerProps {
  originalContent: string;
  modifiedContent: string;
  originalLabel?: string;
  modifiedLabel?: string;
  className?: string;
  height?: number;
  grow?: boolean;
}

export const DiffViewer = ({
  originalContent,
  modifiedContent,
  originalLabel = "Current in Heretto",
  modifiedLabel = "Your editor",
  className = "",
  height = 400,
  grow = false,
}: DiffViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const diffEditorRef = useRef<import('monaco-editor').editor.IStandaloneDiffEditor | null>(null);
  const [lineStats, setLineStats] = useState<{ added: number; removed: number } | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeDiffEditor = async () => {
      if (!containerRef.current) return;

      try {
        const monaco = await loader.init();
        if (!mounted || !containerRef.current) return;

        // Create models
        const originalModel = monaco.editor.createModel(originalContent, 'xml');
        const modifiedModel = monaco.editor.createModel(modifiedContent, 'xml');

        // Create diff editor
        const diffEditor = monaco.editor.createDiffEditor(containerRef.current, {
          readOnly: true,
          automaticLayout: true,
          renderSideBySide: true,
          scrollBeyondLastLine: false,
          minimap: { enabled: false },
          lineNumbers: 'on',
          folding: false,
          wordWrap: 'on',
          fontSize: 12,
          lineHeight: 18,
          glyphMargin: false,
          selectionHighlight: false,
          occurrencesHighlight: false,
          codeLens: false,
          contextmenu: false,
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
        });

        // Set models
        diffEditor.setModel({
          original: originalModel,
          modified: modifiedModel,
        });

        diffEditorRef.current = diffEditor;

        // Calculate line diff stats
        const changes = diffEditor.getLineChanges();
        if (changes) {
          let added = 0;
          let removed = 0;

          changes.forEach((change: import('monaco-editor').editor.ILineChange) => {
            if (change.modifiedEndLineNumber > 0 && change.originalEndLineNumber === 0) {
              // Pure addition
              added += change.modifiedEndLineNumber - change.modifiedStartLineNumber + 1;
            } else if (change.originalEndLineNumber > 0 && change.modifiedEndLineNumber === 0) {
              // Pure deletion
              removed += change.originalEndLineNumber - change.originalStartLineNumber + 1;
            } else if (change.modifiedEndLineNumber > 0 && change.originalEndLineNumber > 0) {
              // Modification - count as both add and remove
              const modifiedLines = change.modifiedEndLineNumber - change.modifiedStartLineNumber + 1;
              const originalLines = change.originalEndLineNumber - change.originalStartLineNumber + 1;
              added += modifiedLines;
              removed += originalLines;
            }
          });

          setLineStats({ added, removed });
        } else {
          setLineStats({ added: 0, removed: 0 });
        }

        // Cleanup function
        return () => {
          originalModel?.dispose();
          modifiedModel?.dispose();
          diffEditor?.dispose();
        };
      } catch (error) {
        console.error('Error initializing diff editor:', error);
      }
    };

    let cleanup: (() => void) | null = null;

    initializeDiffEditor().then(cleanupFn => {
      if (mounted && cleanupFn && typeof cleanupFn === 'function') {
        cleanup = cleanupFn;
      }
    });

    return () => {
      mounted = false;
      if (cleanup) {
        cleanup();
      }
    };
  }, [originalContent, modifiedContent]);

  return (
    <div className={`flex flex-col ${grow ? 'flex-1 min-h-0' : ''} ${className}`}>
      {/* Labels */}
      <div className="flex mb-2">
        <div className="flex-1 text-xs font-medium px-2" style={{ color: 'var(--app-text-secondary)' }}>
          {originalLabel}
        </div>
        <div className="flex-1 text-xs font-medium px-2" style={{ color: 'var(--app-text-secondary)' }}>
          {modifiedLabel}
        </div>
      </div>

      {/* Diff Editor */}
      <div
        ref={containerRef}
        style={{
          ...(grow ? { flex: 1, minHeight: 0 } : { height: `${height}px` }),
          border: '1px solid var(--app-border-subtle)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      />

      {/* Line count summary */}
      {lineStats && (
        <div className="mt-2 text-xs text-center" style={{ color: 'var(--app-text-muted)' }}>
          {lineStats.added > 0 && (
            <span className="mr-4" style={{ color: '#22c55e' }}>
              +{lineStats.added} lines added
            </span>
          )}
          {lineStats.removed > 0 && (
            <span style={{ color: '#ef4444' }}>
              -{lineStats.removed} lines removed
            </span>
          )}
          {lineStats.added === 0 && lineStats.removed === 0 && (
            <span>No changes detected — your content matches the version in Heretto</span>
          )}
        </div>
      )}
    </div>
  );
};