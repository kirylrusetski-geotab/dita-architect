import React from 'react';
import { Tooltip } from '../Tooltip';
import { PANEL_IDS, type PanelId, type PanelState } from '../../lib/workbench-layout';
import { PANEL_META } from './panel-registry';

interface RightRailProps {
  panels: Record<PanelId, PanelState>;
  onToggle: (id: PanelId) => void;
}

/**
 * ADR-017 decision 2: the 36 px rail where the collapsed "XML Source" strip
 * used to be. XML first (it toggles the half-screen split), a separator, then
 * one icon per metadata aspect (each toggles its panel in the stack). An open
 * panel's icon carries the accent on its right edge.
 */
export const RightRail = ({ panels, onToggle }: RightRailProps) => (
  <nav
    className="w-9 shrink-0 flex flex-col"
    style={{ backgroundColor: 'var(--app-surface-raised)', borderLeft: '1px solid var(--app-border)' }}
    aria-label="Panels"
    data-testid="right-rail"
  >
    {PANEL_IDS.map((id, i) => {
      const meta = PANEL_META[id];
      const Icon = meta.icon;
      const open = panels[id].open;
      const tip = id === 'xml' ? 'XML (⌘\\)' : meta.title + (meta.arrives ? ` (coming in ${meta.arrives})` : '');
      return (
        <React.Fragment key={id}>
          {i === 1 && <span className="h-px mx-2 my-1" style={{ backgroundColor: 'var(--app-border-subtle)' }} aria-hidden="true" />}
          <Tooltip content={tip} placement="left">
            <button
              onClick={() => onToggle(id)}
              aria-pressed={open}
              aria-label={`${meta.title} panel`}
              data-testid={`rail-${id}`}
              className="w-9 h-9 flex items-center justify-center transition-colors hover-app-text"
              style={{
                color: open ? 'var(--app-text-primary)' : 'var(--app-text-muted)',
                borderRight: `2px solid ${open ? 'var(--editor-accent)' : 'transparent'}`,
              }}
            >
              <Icon className="w-[17px] h-[17px]" strokeWidth={1.8} />
            </button>
          </Tooltip>
        </React.Fragment>
      );
    })}
  </nav>
);
