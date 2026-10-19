import React, { useEffect, useRef } from 'react';

interface ModalProps {
  onClose: () => void;
  labelId: string;
  children: React.ReactNode;
  className?: string;
  /** Extra inline styles for the dialog surface (e.g. a fixed width). Merged over the theme surface colours. */
  style?: React.CSSProperties;
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Shared modal shell (BUG-11 / BUG-22): one overlay, one Escape handler, one
 * Tab focus trap, focus restored to the opener on unmount, and the
 * `role="dialog"` / `aria-modal` / `aria-labelledby` wiring (WCAG 2.1.2, 2.4.3).
 *
 * Focus rules:
 * - If a child already took focus (an `autoFocus` input or button), it keeps it.
 *   Otherwise the first focusable element is focused.
 * - The mount effect runs once. `onClose` is read through a ref so a parent that
 *   passes a fresh arrow function on every render does not re-run the effect and
 *   yank focus away from an input mid-keystroke.
 */
export const Modal = ({ onClose, labelId, children, className, style }: ModalProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;

    const alreadyFocusedInside = !!dialog && !!document.activeElement && dialog.contains(document.activeElement);
    if (!alreadyFocusedInside) {
      dialog?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }

    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler);
      // Only restore if the opener is still in the document (it may have unmounted with us).
      if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        onKeyDown={handleKeyDown}
        className={className}
        style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border-subtle)', ...style }}
      >
        {children}
      </div>
    </div>
  );
};
