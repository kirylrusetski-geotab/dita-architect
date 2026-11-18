import React, { useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { PANEL_COLUMN, STACK_PANEL_MIN_PX, type PanelState, type StackPanelId } from '../../lib/workbench-layout';
import { PANEL_META } from './panel-registry';

interface PanelColumnProps {
  /** The open stack panels, top to bottom. */
  open: StackPanelId[];
  panels: Record<StackPanelId, PanelState>;
  width: number;
  onResizeColumn: (px: number) => void;
  onResizePanel: (id: StackPanelId, weight: number) => void;
  onClose: (id: StackPanelId) => void;
}

/**
 * ADR-017 decision 2: the metadata panel column. The open aspect panels stack
 * vertically; each takes `size` flex units; a divider between two panels moves
 * height from one to the other, and dragging a panel below `STACK_PANEL_MIN_PX`
 * closes it (W7). The column's left edge resizes its width. Renders nothing
 * when no panel is open.
 */
export const PanelColumn = ({ open, panels, width, onResizeColumn, onResizePanel, onClose }: PanelColumnProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const onWidthDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const move = (ev: MouseEvent) => {
      if (!ref.current) return;
      onResizeColumn(ref.current.getBoundingClientRect().right - ev.clientX);
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }, [onResizeColumn]);

  /** Drag the divider under panel `above`: the two neighbours trade height; below the minimum, the shrinking one closes. */
  const onDividerDown = useCallback((e: React.MouseEvent, above: StackPanelId, below: StackPanelId) => {
    e.preventDefault();
    const col = ref.current;
    if (!col) return;
    const a = col.querySelector<HTMLElement>(`[data-panel="${above}"]`);
    const b = col.querySelector<HTMLElement>(`[data-panel="${below}"]`);
    if (!a || !b) return;
    const startY = e.clientY;
    const hA = a.getBoundingClientRect().height;
    const hB = b.getBoundingClientRect().height;
    const wA = panels[above].size;
    const wB = panels[below].size;
    const pxPerWeight = (hA + hB) / (wA + wB);
    let done = false;
    const move = (ev: MouseEvent) => {
      if (done) return;
      const dy = ev.clientY - startY;
      const nextA = hA + dy;
      const nextB = hB - dy;
      if (nextA < STACK_PANEL_MIN_PX) { done = true; onClose(above); return; }
      if (nextB < STACK_PANEL_MIN_PX) { done = true; onClose(below); return; }
      onResizePanel(above, nextA / pxPerWeight);
      onResizePanel(below, nextB / pxPerWeight);
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }, [panels, onResizePanel, onClose]);

  if (open.length === 0) return null;

  return (
    <div
      ref={ref}
      className="relative flex flex-col min-h-0 shrink-0"
      style={{ width, minWidth: PANEL_COLUMN.min, maxWidth: PANEL_COLUMN.max, backgroundColor: 'var(--app-bg)', borderLeft: '1px solid var(--app-border)' }}
      data-testid="panel-column"
    >
      <div
        className="absolute top-0 -left-[3px] w-[6px] h-full cursor-col-resize z-10 hover:bg-sky-500/20"
        onMouseDown={onWidthDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel column"
      />
      {open.map((id, i) => {
        const meta = PANEL_META[id];
        const Icon = meta.icon;
        return (
          <React.Fragment key={id}>
            {i > 0 && (
              <div
                className="h-[5px] shrink-0 cursor-row-resize flex items-center justify-center hover-app"
                style={{ backgroundColor: 'var(--app-surface)', borderTop: '1px solid var(--app-border)', borderBottom: '1px solid var(--app-border)' }}
                onMouseDown={e => onDividerDown(e, open[i - 1], id)}
                role="separator"
                aria-orientation="horizontal"
                aria-label={`Resize ${PANEL_META[open[i - 1]].title} and ${meta.title}`}
                title="Drag to resize; below 120 px closes the panel"
              >
                <span className="w-7 h-px opacity-50" style={{ backgroundColor: 'var(--app-text-muted)' }} />
              </div>
            )}
            <section
              data-panel={id}
              data-testid={`panel-${id}`}
              aria-label={`${meta.title} panel`}
              className="flex flex-col min-h-0"
              style={{ flex: `${panels[id].size} 1 0px` }}
            >
              <div
                className="h-[30px] shrink-0 flex items-center gap-1.5 pl-2.5 pr-1.5 text-[11px] font-bold uppercase tracking-widest"
                style={{ backgroundColor: 'var(--app-surface-raised)', borderBottom: '1px solid var(--app-border-subtle)', color: 'var(--app-text-muted)' }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="flex-1">{meta.title}</span>
                <button
                  onClick={() => onClose(id)}
                  className="w-[22px] h-[22px] rounded flex items-center justify-center hover-app-text"
                  style={{ color: 'var(--app-text-muted)' }}
                  aria-label={`Close ${meta.title} panel`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-auto custom-scrollbar px-3.5 py-3 text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                {meta.arrives && (
                  <span
                    className="inline-block text-[10px] font-semibold px-2 py-px rounded-full mb-2"
                    style={{ border: '1px solid var(--app-border-subtle)', backgroundColor: 'var(--app-surface-raised)', color: 'var(--app-text-secondary)' }}
                  >
                    Coming in {meta.arrives}
                  </span>
                )}
                <h3 className="m-0 mb-1.5 text-xs font-semibold" style={{ color: 'var(--app-text-secondary)' }}>{meta.title} panel</h3>
                <p className="m-0">{meta.blurb}</p>
              </div>
            </section>
          </React.Fragment>
        );
      })}
    </div>
  );
};
