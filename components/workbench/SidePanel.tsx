import React, { useCallback, useRef } from 'react';
import { SIDE_PANEL } from '../../lib/workbench-layout';

interface SidePanelProps {
  width: number;
  onResize: (px: number) => void;
  children: React.ReactNode;
}

/**
 * ADR-017 decision 1: the side panel host. One column, resizable 200–480 px
 * from its right edge (the width is persisted by the layout hook); the active
 * view renders inside. Collapsing is the activity bar's job (click the active
 * view's icon), not a drag: the width is clamped, never closes.
 */
export const SidePanel = ({ width, onResize, children }: SidePanelProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onHandleDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const move = (ev: MouseEvent) => {
      if (!dragging.current || !ref.current) return;
      onResize(ev.clientX - ref.current.getBoundingClientRect().left);
    };
    const up = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }, [onResize]);

  return (
    <aside
      ref={ref}
      className="relative flex flex-col min-h-0 shrink-0"
      style={{ width, minWidth: SIDE_PANEL.min, maxWidth: SIDE_PANEL.max, backgroundColor: 'var(--app-surface)', borderRight: '1px solid var(--app-border)' }}
      data-testid="side-panel"
    >
      {children}
      <div
        className="absolute top-0 -right-[3px] w-[6px] h-full cursor-col-resize z-10 hover:bg-sky-500/20"
        onMouseDown={onHandleDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize side panel"
      />
    </aside>
  );
};

interface ViewHeaderProps {
  title: string;
  /** Right-aligned controls (the Explorer's `…` menu button). */
  actions?: React.ReactNode;
}

export const ViewHeader = ({ title, actions }: ViewHeaderProps) => (
  <div className="h-[35px] flex items-center justify-between pl-4 pr-2 shrink-0">
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] m-0" style={{ color: 'var(--app-text-secondary)' }}>{title}</h2>
    {actions}
  </div>
);
