import React from 'react';
import { ViewHeader } from '../SidePanel';
import { VIEW_META } from '../panel-registry';
import type { ViewId } from '../../../lib/workbench-layout';

/**
 * ADR-017 decision 5: Search, Map and Source Control render this until their
 * session fills them, so the rail is complete from day one and later sessions
 * fill a panel rather than redesign the rail.
 */
export const PlaceholderView = ({ view }: { view: ViewId }) => {
  const meta = VIEW_META[view];
  return (
    <section className="flex-1 flex flex-col min-h-0" aria-label={`${meta.title} view`} data-testid={`view-${view}`}>
      <ViewHeader title={meta.title} />
      <div className="px-4 py-3 text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
        {meta.arrives && (
          <span
            className="inline-block text-[10px] font-semibold px-2 py-px rounded-full mb-2.5"
            style={{ border: '1px solid var(--app-border-subtle)', backgroundColor: 'var(--app-surface-raised)', color: 'var(--app-text-secondary)' }}
          >
            Coming in {meta.arrives}
          </span>
        )}
        <p className="m-0">{meta.blurb}</p>
      </div>
    </section>
  );
};
