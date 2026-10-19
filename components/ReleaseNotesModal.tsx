import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, X } from 'lucide-react';
import { RELEASE_NOTES, ReleaseNote } from '../constants/version';
import { Modal } from './Modal';

interface ReleaseNotesModalProps {
  onClose: () => void;
}

interface TagStyle {
  label: string;
  bg: string;
  color: string;
}

const SECTION_TAG_MAP: Record<string, TagStyle> = {
  'Bug Fixes':                    { label: 'FIX',    bg: 'rgba(239,68,68,0.12)',    color: '#ef4444' },
  'Reliability':                  { label: 'FIX',    bg: 'rgba(239,68,68,0.12)',    color: '#ef4444' },
  'Sync & Data Integrity':        { label: 'FIX',    bg: 'rgba(239,68,68,0.12)',    color: '#ef4444' },
  'New':                          { label: 'NEW',    bg: 'rgba(16,185,129,0.12)',   color: '#10b981' },
  'Improvements':                 { label: 'UPD',    bg: 'rgba(234,179,8,0.12)',    color: '#eab308' },
  'Known Limits':                 { label: 'LIMIT',  bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' },
  'New Features':                 { label: 'NEW',    bg: 'rgba(16,185,129,0.12)',   color: '#10b981' },
  'New API Endpoint':             { label: 'NEW',    bg: 'rgba(16,185,129,0.12)',   color: '#10b981' },
  'Content Insertion':            { label: 'NEW',    bg: 'rgba(16,185,129,0.12)',   color: '#10b981' },
  'Discoverability':              { label: 'NEW',    bg: 'rgba(16,185,129,0.12)',   color: '#10b981' },
  'Edit Mode & Tracked Changes':  { label: 'NEW',    bg: 'rgba(16,185,129,0.12)',   color: '#10b981' },
  'Heretto CMS Integration':      { label: 'NEW',    bg: 'rgba(16,185,129,0.12)',   color: '#10b981' },
  'Visual Editor':                { label: 'NEW',    bg: 'rgba(16,185,129,0.12)',   color: '#10b981' },
  'API':                          { label: 'API',    bg: 'rgba(59,130,246,0.12)',   color: '#3b82f6' },
  'How it works':                 { label: 'API',    bg: 'rgba(59,130,246,0.12)',   color: '#3b82f6' },
  'Polish':                       { label: 'POLISH', bg: 'rgba(139,92,246,0.12)',   color: '#8b5cf6' },
  'Copy & Polish':                { label: 'POLISH', bg: 'rgba(139,92,246,0.12)',   color: '#8b5cf6' },
  'Editor Polish':                { label: 'POLISH', bg: 'rgba(139,92,246,0.12)',   color: '#8b5cf6' },
  'Theme':                        { label: 'POLISH', bg: 'rgba(139,92,246,0.12)',   color: '#8b5cf6' },
  'Terminology':                  { label: 'POLISH', bg: 'rgba(139,92,246,0.12)',   color: '#8b5cf6' },
  'Accessibility':                { label: 'A11Y',   bg: 'rgba(20,184,166,0.12)',   color: '#14b8a6' },
  'Under the Hood':               { label: 'DEV',    bg: 'rgba(148,163,184,0.12)',  color: '#94a3b8' },
};

const DEFAULT_TAG: TagStyle = { label: 'NOTE', bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' };

interface FlatItem {
  tag: string;
  bg: string;
  color: string;
  item: string;
}

function flattenSections(sections: ReleaseNote['sections']): FlatItem[] {
  const result: FlatItem[] = [];
  for (const section of sections) {
    const style = SECTION_TAG_MAP[section.heading] ?? DEFAULT_TAG;
    for (const item of section.items) {
      result.push({ tag: style.label, bg: style.bg, color: style.color, item });
    }
  }
  return result;
}

function renderMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={i}
          className="font-mono text-[0.85em] px-1 py-0.5 rounded"
          style={{
            backgroundColor: 'var(--editor-code-bg)',
            color: 'var(--editor-code-text)',
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export const ReleaseNotesModal = ({ onClose }: ReleaseNotesModalProps) => {
  const [selectedVersion, setSelectedVersion] = useState(RELEASE_NOTES[0].version);
  const release = RELEASE_NOTES.find(r => r.version === selectedVersion) ?? RELEASE_NOTES[0];
  const flatItems = flattenSections(release.sections);
  const contentRef = useRef<HTMLDivElement>(null);
  const versionListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [selectedVersion]);

  const handleVersionKeyDown = (e: React.KeyboardEvent) => {
    const versions = RELEASE_NOTES.map(r => r.version);
    const idx = versions.indexOf(selectedVersion);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedVersion(versions[Math.min(idx + 1, versions.length - 1)]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedVersion(versions[Math.max(idx - 1, 0)]);
    }
  };

  return (
    <Modal onClose={onClose} labelId="release-notes-title" className="rounded-xl p-6 w-[800px] max-w-[92vw] max-h-[82vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-dita-500 to-dita-600 flex items-center justify-center shadow-lg shadow-dita-500/20">
              <BookOpen className="text-white w-5 h-5" />
            </div>
            <div>
              <h3 id="release-notes-title" className="text-lg font-bold" style={{ color: 'var(--app-text-primary)' }}>
                DITA <span className="text-dita-500">Architect</span>
              </h3>
              <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>Release Notes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close release notes"
            className="rounded-md p-1 transition-colors hover:bg-black/10"
            style={{ color: 'var(--app-text-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Two-column layout */}
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Version list */}
          <div
            ref={versionListRef}
            tabIndex={0}
            onKeyDown={handleVersionKeyDown}
            className="w-32 shrink-0 overflow-y-auto rounded-lg py-1 outline-none"
            style={{
              backgroundColor: 'var(--app-surface-raised)',
              border: '1px solid var(--app-border-subtle)',
            }}
          >
            {RELEASE_NOTES.map(r => (
              <button
                key={r.version}
                onClick={() => setSelectedVersion(r.version)}
                className="w-full text-left px-3 py-2 text-xs font-mono transition-colors rounded-md"
                style={{
                  color: r.version === selectedVersion ? 'var(--editor-accent)' : 'var(--app-text-secondary)',
                  backgroundColor: r.version === selectedVersion ? 'var(--app-surface)' : 'transparent',
                  fontWeight: r.version === selectedVersion ? 600 : 400,
                }}
              >
                v{r.version}
              </button>
            ))}
          </div>

          {/* Release content */}
          <div ref={contentRef} className="flex-1 overflow-y-auto pr-1">
            {/* Version header */}
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-sm font-bold" style={{ color: 'var(--app-text-primary)' }}>
                v{release.version}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                {release.date}
              </span>
            </div>
            <p className="text-xs mb-5 leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
              {renderMarkdown(release.title)}
            </p>

            {/* Flat tagged item list */}
            <div className="space-y-3">
              {flatItems.map(({ tag, bg, color, item }, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span
                    className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase"
                    style={{ backgroundColor: bg, color }}
                  >
                    {tag}
                  </span>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--app-text-secondary)' }}>
                    {renderMarkdown(item)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

    </Modal>
  );
};
