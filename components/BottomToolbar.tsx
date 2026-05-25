import React, { useState, useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot } from 'lexical';
import { analyzeText } from '../textAnalysis';
import { Tooltip } from './Tooltip';

const DEBOUNCE_MS = 300;

export const BottomToolbar = () => {
  const [editor] = useLexicalComposerContext();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stats, setStats] = useState(() => {
    let initialStats = {
      wordCount: 0,
      characterCount: 0,
      score: '-' as string | number,
      readingLevel: '-',
      gradeLevel: '-' as string | number,
      note: '-',
      sentenceCount: 0,
      syllableCount: 0,
    };
    try {
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const text = root.getTextContent();
        initialStats = analyzeText(text);
      });
    } catch (error) {
      console.warn('BottomToolbar: Failed to read initial editor state:', error);
      // Keep default initialStats (zeros) as fallback
    }
    return initialStats;
  });

  useEffect(() => {
    const unregister = editor.registerUpdateListener(({ editorState }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        editorState.read(() => {
          const root = $getRoot();
          const text = root.getTextContent();
          setStats(analyzeText(text));
        });
      }, DEBOUNCE_MS);
    });

    // Immediately read current state to catch content parsed before listener attached
    try {
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const text = root.getTextContent();
        setStats(analyzeText(text));
      });
    } catch (error) {
      console.warn('BottomToolbar: Failed to read current editor state:', error);
      // Stats will remain at initial values
    }

    return unregister;
  }, [editor]);

  // Cleanup pending timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div
      className="absolute bottom-0 left-0 right-0 h-8 flex items-center px-4 gap-4 z-10 text-[10px] font-mono"
      style={{
        backgroundColor: 'var(--editor-bottom-bg)',
        borderTop: '1px solid var(--editor-bottom-border)',
        color: 'var(--editor-bottom-text)',
      }}
    >
      <div className="flex items-center gap-1">
        <span className="font-semibold" style={{ color: 'var(--editor-bottom-text-strong)' }}>{stats.wordCount}</span> words
      </div>
      <div className="w-px h-3" style={{ backgroundColor: 'var(--editor-bottom-border)' }} />
      <div className="flex items-center gap-1">
        <span className="font-semibold" style={{ color: 'var(--editor-bottom-text-strong)' }}>{stats.characterCount}</span> characters
      </div>
      <div className="w-px h-3" style={{ backgroundColor: 'var(--editor-bottom-border)' }} />
      <Tooltip
        placement="top"
        content={stats.score !== '-'
          ? `${stats.note} — Flesch Reading Ease ${stats.score}/100 (60–70 is ideal for technical docs)`
          : 'Flesch Reading Ease score — 60–70 is ideal for technical documentation'}
      >
        <div className="flex items-center gap-1">
          Readability: <span className="font-semibold" style={{ color: 'var(--editor-bottom-text-strong)' }}>{stats.score}</span>
          {stats.gradeLevel !== '-' && <span className="ml-1" style={{ opacity: 0.6 }}>({stats.gradeLevel} grade)</span>}
        </div>
      </Tooltip>
    </div>
  );
};
