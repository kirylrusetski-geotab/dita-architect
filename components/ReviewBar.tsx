import { Check, X, GitCompareArrows } from 'lucide-react';

interface ReviewBarProps {
  sourceLabel?: string;
  onAccept: () => void;
  onReject: () => void;
}

/**
 * FR-045: bar above the Monaco diff when a tab has a pendingReview — an API
 * insertion staged as `currentXml → proposedXml`, accepted or rejected as a
 * whole. What is shown in the diff is byte-for-byte what Accept commits.
 */
export const ReviewBar = ({ sourceLabel, onAccept, onReject }: ReviewBarProps) => {
  return (
    <div
      className="h-9 shrink-0 flex items-center justify-between px-4"
      style={{
        backgroundColor: 'color-mix(in srgb, #f59e0b 8%, var(--app-surface))',
        borderBottom: '1px solid color-mix(in srgb, #f59e0b 25%, var(--app-border))',
      }}
    >
      <div className="flex items-center gap-2 text-xs min-w-0">
        <GitCompareArrows className="w-3.5 h-3.5 shrink-0" style={{ color: '#f59e0b' }} />
        <span style={{ color: 'var(--app-text-muted)' }}>Proposed change:</span>
        <span className="truncate font-medium" style={{ color: 'var(--app-text-primary)' }}>
          {sourceLabel ?? 'API'}
        </span>
        <span style={{ color: 'var(--app-text-muted)' }}>— review the diff, then accept or reject</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onAccept}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors"
          style={{ backgroundColor: '#22c55e', color: '#ffffff', border: '1px solid #22c55e' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#16a34a'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#22c55e'; }}
          title="Apply the proposed change to the document"
          aria-label="Accept proposed change"
        >
          <Check className="w-3 h-3" />
          Accept
        </button>

        <button
          onClick={onReject}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors"
          style={{
            backgroundColor: 'var(--app-surface-raised)',
            border: '1px solid #ef4444',
            color: '#ef4444',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'color-mix(in srgb, #ef4444 12%, var(--app-surface-raised))'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--app-surface-raised)'; }}
          title="Discard the proposed change"
          aria-label="Reject proposed change"
        >
          <X className="w-3 h-3" />
          Reject
        </button>
      </div>
    </div>
  );
};
