import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { RELEASE_NOTES } from '../constants/version';

interface ReleaseNotesModalProps {
  onClose: () => void;
}

export const ReleaseNotesModal = ({ onClose }: ReleaseNotesModalProps) => {
  const [selectedVersion, setSelectedVersion] = useState(RELEASE_NOTES[0].version);
  const release = RELEASE_NOTES.find(r => r.version === selectedVersion) ?? RELEASE_NOTES[0];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-notes-title"
        className="rounded-xl p-6 w-[680px] max-h-[82vh] flex flex-col shadow-2xl"
        style={{
          backgroundColor: 'var(--app-surface)',
          border: '1px solid var(--app-border-subtle)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
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

        {/* Two-column layout */}
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Version list */}
          <div
            className="w-32 shrink-0 overflow-y-auto rounded-lg py-1"
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
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-sm" style={{ color: 'var(--app-text-secondary)' }}>
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-sm font-bold" style={{ color: 'var(--app-text-primary)' }}>
                  v{release.version}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                  {release.date}
                </span>
              </div>
              <p className="text-xs mb-4" style={{ color: 'var(--app-text-primary)' }}>
                {release.title}
              </p>

              <div className="space-y-3">
                {release.sections.map((section) => (
                  <section key={section.heading}>
                    <h4 className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--app-text-muted)' }}>
                      {section.heading}
                    </h4>
                    <ul className="space-y-1 text-xs list-disc list-inside">
                      {section.items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--app-border-subtle)' }}>
          <button
            autoFocus
            onClick={onClose}
            className="w-full py-2 rounded-lg text-sm font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
