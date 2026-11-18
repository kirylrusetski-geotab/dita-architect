import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export type PopoverPlacement = 'right-start' | 'right-end' | 'bottom-start' | 'bottom-end' | 'top-end';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** The element the popover is positioned against and that gets focus back on close. */
  anchorRef: React.RefObject<HTMLElement | null>;
  placement?: PopoverPlacement;
  /** `menu`: arrow keys move between `role="menuitem"` children. `dialog`: a small form or status card. */
  role?: 'menu' | 'dialog';
  ariaLabel: string;
  width?: number;
  /** Change this when the popover swaps its content (a sub-page): focus moves to the new first item. */
  focusKey?: string;
  children: React.ReactNode;
}

const MENU_ITEMS = '[role="menuitem"]:not([disabled])';
const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const GAP = 6;

/**
 * ADR-017 decision 6: the one anchored popover / menu (the rail popovers, the
 * gear menu, the Explorer `…` menu, the XML pane's syntax-theme menu). Fixed
 * position next to its anchor, clamped to the viewport; closes on Escape and
 * on a click outside itself and its anchor; `role="menu"` gets Home/End and
 * arrow-key movement and focuses its first item on open; focus returns to the
 * anchor on close (BUG-22's rule for every new surface).
 */
export const Popover = ({ open, onClose, anchorRef, placement = 'bottom-start', role = 'menu', ariaLabel, width, focusKey, children }: PopoverProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Position against the anchor once the content has a size.
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const anchor = anchorRef.current;
    const el = ref.current;
    if (!anchor || !el) return;
    const a = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left: number;
    let top: number;
    switch (placement) {
      case 'right-start': left = a.right + GAP; top = a.top; break;
      case 'right-end': left = a.right + GAP; top = a.bottom - h; break;
      case 'bottom-end': left = a.right - w; top = a.bottom + GAP; break;
      case 'top-end': left = a.right - w; top = a.top - GAP - h; break;
      case 'bottom-start':
      default: left = a.left; top = a.bottom + GAP; break;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (left + w > vw - GAP) left = Math.max(GAP, vw - GAP - w);
    if (left < GAP) left = GAP;
    if (top + h > vh - GAP) top = Math.max(GAP, vh - GAP - h);
    if (top < GAP) top = GAP;
    setPos({ left, top });
  }, [open, anchorRef, placement, children]);

  // Escape, click outside, focus management.
  useEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const el = ref.current;
    const first = role === 'menu'
      ? el?.querySelector<HTMLElement>(MENU_ITEMS)
      : el?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // A modal dialog above us (components/Modal.tsx) owns Escape while it is open.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      e.stopPropagation();
      onCloseRef.current();
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (el?.contains(t) || anchor?.contains(t)) return;
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      // React detaches the node before this cleanup runs, so a focused item has
      // already fallen back to <body>; both cases mean focus was ours to return.
      const active = document.activeElement;
      if (anchor && anchor.isConnected && (!active || active === document.body || el?.contains(active))) anchor.focus();
    };
  }, [open, anchorRef, role]);

  // A sub-page swap unmounts the focused item; put focus on the new first item.
  useEffect(() => {
    if (!open || focusKey === undefined) return;
    const el = ref.current;
    const first = role === 'menu' ? el?.querySelector<HTMLElement>(MENU_ITEMS) : el?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
  }, [open, focusKey, role]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (role !== 'menu') return;
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>(MENU_ITEMS) ?? []);
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
  };

  if (!open) return null;
  return (
    <div
      ref={ref}
      role={role}
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className="fixed z-40 rounded-lg shadow-xl py-1 text-xs"
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        visibility: pos ? 'visible' : 'hidden',
        minWidth: width ?? 200,
        backgroundColor: 'var(--app-surface-raised)',
        border: '1px solid var(--app-border-subtle)',
        color: 'var(--app-text-secondary)',
      }}
    >
      {children}
    </div>
  );
};

interface MenuItemProps {
  icon?: React.ReactNode;
  label: string;
  shortcut?: string;
  /** A trailing marker: a check for the active option, a chevron for a sub-page. */
  trailing?: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  onSelect: () => void;
}

export const MenuItem = ({ icon, label, shortcut, trailing, disabled, active, onSelect }: MenuItemProps) => (
  <button
    role="menuitem"
    disabled={disabled}
    onClick={onSelect}
    className="w-full text-left px-3 py-1.5 text-xs font-medium flex items-center gap-2 whitespace-nowrap transition-colors hover-app disabled:opacity-50"
    style={{ color: active ? 'var(--editor-accent)' : 'var(--app-text-secondary)' }}
  >
    {icon && <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center [&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>}
    <span className="flex-1">{label}</span>
    {shortcut && <span className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>{shortcut}</span>}
    {trailing}
  </button>
);

export const MenuDivider = () => <div className="my-1 mx-2" style={{ borderTop: '1px solid var(--app-border-subtle)' }} />;

export const MenuHeading = ({ children }: { children: React.ReactNode }) => (
  <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>{children}</div>
);
