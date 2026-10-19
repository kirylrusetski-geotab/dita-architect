import React from 'react';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import type { ImportVerificationState } from '../types/heretto';
import { Modal } from './Modal';

interface ImportVerificationModalProps {
  data: ImportVerificationState;
  onClose: () => void;
  onContinue: () => void;
}

export const ImportVerificationModal = ({ data, onClose, onContinue }: ImportVerificationModalProps) => (
  <Modal
    onClose={onClose}
    labelId={
      data.phase === 'downloading' ? 'import-downloading-heading' :
      data.phase === 'verifying' ? 'import-verifying-heading' :
      (data.phase === 'results' && data.verified && data.unrecognizedElements.length === 0) ? 'import-ready-heading' :
      'import-review-heading'
    }
    className="rounded-xl p-6 w-[440px] shadow-2xl"
  >
      {data.phase === 'downloading' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--editor-accent)' }} />
            <h3 id="import-downloading-heading" className="text-lg font-bold" style={{ color: 'var(--app-text-primary)' }}>
              Downloading topic...
            </h3>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden mb-3" style={{ backgroundColor: 'var(--app-surface-raised)' }}>
            <div
              className="h-full rounded-full animate-pulse"
              style={{ width: '33%', backgroundColor: 'var(--editor-accent)' }}
            />
          </div>
          <p className="text-xs font-mono truncate" style={{ color: 'var(--app-text-muted)' }}>
            {data.item.name}
          </p>
        </>
      )}

      {data.phase === 'verifying' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--editor-accent)' }} />
            <h3 id="import-verifying-heading" className="text-lg font-bold" style={{ color: 'var(--app-text-primary)' }}>
              Verifying integrity...
            </h3>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden mb-3" style={{ backgroundColor: 'var(--app-surface-raised)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: '66%', backgroundColor: 'var(--editor-accent)' }}
            />
          </div>
          <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
            Re-fetching to confirm download integrity
          </p>
        </>
      )}

      {data.phase === 'results' && (
        <>
          {data.verified && data.unrecognizedElements.length === 0 ? (
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <h3 id="import-ready-heading" className="text-lg font-bold" style={{ color: 'var(--app-text-primary)' }}>
                Ready to open
              </h3>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 id="import-review-heading" className="text-lg font-bold" style={{ color: 'var(--app-text-primary)' }}>
                Review before opening
              </h3>
            </div>
          )}

          {/* Integrity status */}
          <div
            className="rounded-lg px-3 py-2 text-sm mb-3 flex items-center gap-2"
            style={{
              backgroundColor: data.verified
                ? 'rgba(16, 185, 129, 0.1)'
                : 'rgba(245, 158, 11, 0.1)',
              border: `1px solid ${data.verified ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              color: data.verified ? '#10b981' : '#f59e0b',
            }}
          >
            {data.verified ? (
              <><CheckCircle className="w-4 h-4 shrink-0" /> Integrity check passed</>
            ) : (
              <><AlertTriangle className="w-4 h-4 shrink-0" /> Integrity check failed &mdash; content differed between fetches</>
            )}
          </div>

          {/* Unrecognized elements */}
          {data.unrecognizedElements.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--app-text-secondary)' }}>
              Unsupported DITA elements
            </p>
            <p className="text-[11px] mb-2" style={{ color: 'var(--app-text-muted)' }}>
              These elements are preserved in the XML source editor but won't render in the visual editor.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.unrecognizedElements.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded text-xs font-mono"
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#f59e0b',
                  }}
                >
                  &lt;{tag}&gt;
                </span>
              ))}
            </div>
          </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors hover-btn"
              style={{
                backgroundColor: 'var(--app-surface-raised)',
                border: '1px solid var(--app-border-subtle)',
                color: 'var(--app-text-secondary)',
              }}
            >
              Cancel
            </button>
            <button
              autoFocus
              onClick={onContinue}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors"
            >
              {data.verified ? 'Open Topic' : 'Open Anyway'}
            </button>
          </div>
        </>
      )}
  </Modal>
);
