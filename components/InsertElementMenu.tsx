import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { INSERTABLE_ELEMENTS, InsertableElement } from '../constants/insertable-elements';

interface Position {
  x: number;
  y: number;
}

interface InsertElementMenuProps {
  position: Position;
  onSelect: (element: InsertableElement) => void;
  onClose: () => void;
}

const filterElements = (query: string): InsertableElement[] => {
  const q = query.trim().toLowerCase();
  if (!q) return INSERTABLE_ELEMENTS;
  return INSERTABLE_ELEMENTS.filter((el) => {
    if (el.displayName.toLowerCase().includes(q)) return true;
    if (el.ditaTag.toLowerCase().includes(q)) return true;
    return el.searchTerms.some((t) => t.toLowerCase().includes(q));
  });
};

export const InsertElementMenu = ({ position, onSelect, onClose }: InsertElementMenuProps) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => filterElements(query), [query]);

  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(0);
  }, [filtered.length, activeIndex]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [onClose]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const el = filtered[activeIndex];
      if (el) onSelect(el);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const menuWidth = 280;
  const menuHeight = 320; // conservative: search input + up to 8 items
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const clampedX = Math.max(8, Math.min(position.x, viewportWidth - menuWidth - 8));
  const clampedY = Math.max(8, Math.min(position.y, viewportHeight - menuHeight - 8));

  return createPortal(
    <div
      ref={menuRef}
      className="fixed rounded-lg shadow-xl border overflow-hidden"
      role="dialog"
      aria-label="Insert element"
      style={{
        left: clampedX,
        top: clampedY,
        zIndex: 80,
        width: menuWidth,
        backgroundColor: 'var(--app-surface-raised)',
        borderColor: 'var(--app-border-subtle)',
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Search elements…"
        aria-label="Search insertable elements"
        className="w-full px-3 py-2 text-sm outline-none border-b"
        style={{
          backgroundColor: 'transparent',
          color: 'var(--app-text-primary)',
          borderColor: 'var(--app-border-subtle)',
        }}
      />
      <ul role="menu" className="max-h-64 overflow-y-auto custom-scrollbar py-1">
        {filtered.length === 0 ? (
          <li
            className="px-3 py-2 text-xs"
            style={{ color: 'var(--app-text-muted)' }}
          >
            No matches
          </li>
        ) : (
          filtered.map((el, i) => (
            <li
              key={el.ditaTag}
              role="menuitem"
              aria-selected={i === activeIndex}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(el);
              }}
              className="flex justify-between items-center px-3 py-1.5 text-sm cursor-pointer"
              style={{
                color: 'var(--app-text-primary)',
                backgroundColor: i === activeIndex ? 'var(--app-hover, rgba(127,127,127,0.12))' : 'transparent',
              }}
            >
              <span>{el.displayName}</span>
              <code
                className="text-[10px]"
                style={{ color: 'var(--app-text-muted)' }}
              >
                {el.ditaTag}
              </code>
            </li>
          ))
        )}
      </ul>
    </div>,
    document.body,
  );
};
