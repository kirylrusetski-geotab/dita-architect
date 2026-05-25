import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { InsertElementMenu } from './InsertElementMenu';
import { InsertableElement } from '../constants/insertable-elements';

type ButtonState = {
  blockKey: string;
  rect: DOMRect;
} | null;

type MenuState = {
  blockKey: string;
  position: { x: number; y: number };
} | null;

export const InsertElementPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const [hover, setHover] = useState<ButtonState>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const hoverRef = useRef<ButtonState>(null);
  const clearTimerRef = useRef<number | null>(null);

  hoverRef.current = hover;

  const cancelClear = useCallback(() => {
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  }, []);

  const scheduleClear = useCallback(() => {
    cancelClear();
    clearTimerRef.current = window.setTimeout(() => {
      if (!menu) setHover(null);
    }, 120);
  }, [cancelClear, menu]);

  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const findTopLevelBlock = (target: EventTarget | null): HTMLElement | null => {
      let el = target as HTMLElement | null;
      while (el && el.parentElement !== rootElement) {
        el = el.parentElement;
      }
      if (!el || el.parentElement !== rootElement) return null;
      return el;
    };

    // Lexical stores the node key directly on each DOM element as a property.
    // We read it this way to avoid $getNearestNodeFromDOMNode, which requires
    // getActiveEditor() — only available inside editor.update(), not read().
    const editorInternalKey = (editor as unknown as { _key: string })._key;

    const getBlockKey = (block: HTMLElement): string | null => {
      const key = (block as unknown as Record<string, string>)[`__lexicalKey_${editorInternalKey}`];
      return key ?? null;
    };

    const isNearButton = (mx: number, my: number): boolean => {
      const current = hoverRef.current;
      if (!current) return false;
      // Replicate computeButtonPosition inline to avoid an unstable dep
      const pageWrapper = rootElement.parentElement ?? null;
      const pageRect = pageWrapper?.getBoundingClientRect();
      const gutterOffset = 32;
      const btnLeft = (pageRect && pageRect.left >= gutterOffset + 8)
        ? pageRect.left - gutterOffset
        : pageRect ? pageRect.left + 8 : current.rect.left - 28;
      const btnTop = current.rect.top + current.rect.height / 2 - 12;
      const pad = 48;
      return mx >= btnLeft - pad && mx <= btnLeft + 24 + pad
          && my >= btnTop - pad && my <= btnTop + 24 + pad;
    };

    const handleMove = (e: MouseEvent) => {
      if (menu) return;
      const block = findTopLevelBlock(e.target);
      if (block) {
        cancelClear();
        const blockKey = getBlockKey(block);
        if (!blockKey) { scheduleClear(); return; }
        const rect = block.getBoundingClientRect();
        const current = hoverRef.current;
        if (
          !current ||
          current.blockKey !== blockKey ||
          current.rect.top !== rect.top ||
          current.rect.left !== rect.left ||
          current.rect.height !== rect.height
        ) {
          setHover({ blockKey, rect });
        }
        return;
      }
      // Mouse is outside the editor. Keep button alive if mouse is near it.
      if (isNearButton(e.clientX, e.clientY)) {
        cancelClear();
      } else {
        scheduleClear();
      }
    };

    const scrollContainer = rootElement.parentElement?.parentElement ?? null;
    const reposition = () => {
      if (menu) return;
      const current = hoverRef.current;
      if (!current) return;
      const blockEl = editor.getElementByKey(current.blockKey);
      if (!blockEl) { setHover(null); return; }
      setHover({ blockKey: current.blockKey, rect: blockEl.getBoundingClientRect() });
    };

    document.addEventListener('mousemove', handleMove);
    scrollContainer?.addEventListener('scroll', reposition, { passive: true });
    window.addEventListener('resize', reposition);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      scrollContainer?.removeEventListener('scroll', reposition);
      window.removeEventListener('resize', reposition);
      cancelClear();
    };
  }, [editor, menu, scheduleClear, cancelClear]);

  const computeButtonPosition = (rect: DOMRect): { left: number; top: number } => {
    const pageWrapper = editor.getRootElement()?.parentElement ?? null;
    const pageRect = pageWrapper?.getBoundingClientRect();
    const buttonSize = 24;
    const gutterOffset = 32;
    let left: number;
    if (pageRect && pageRect.left >= gutterOffset + 8) {
      left = pageRect.left - gutterOffset;
    } else {
      // No canvas margin — tuck into the page's left padding (page has 3rem = 48px padding)
      left = pageRect ? pageRect.left + 8 : rect.left - 28;
    }
    const top = rect.top + rect.height / 2 - buttonSize / 2;
    return { left, top };
  };

  const handleOpenMenu = () => {
    const current = hoverRef.current;
    if (!current) return;
    const { top } = computeButtonPosition(current.rect);
    const pageWrapper = editor.getRootElement()?.parentElement ?? null;
    const pageRect = pageWrapper?.getBoundingClientRect();
    const menuWidth = 280;
    // Open in canvas margin (left of page) when there's room; otherwise align to page edge
    let menuX: number;
    if (pageRect && pageRect.left - menuWidth - 8 >= 0) {
      menuX = Math.max(8, pageRect.left - menuWidth);
    } else {
      menuX = pageRect ? pageRect.left : 8;
    }
    // Place below the button; Y clamping is handled inside InsertElementMenu
    const menuY = top + 28;
    setMenu({
      blockKey: current.blockKey,
      position: { x: menuX, y: menuY },
    });
  };

  const handleInsert = (element: InsertableElement) => {
    if (!menu) return;
    element.insert(editor, menu.blockKey);
    setMenu(null);
    setHover(null);
  };

  const handleCloseMenu = () => {
    setMenu(null);
  };

  const button = hover && (() => {
    const { left, top } = computeButtonPosition(hover.rect);
    return createPortal(
      <button
        type="button"
        aria-label="Insert element"
        onMouseEnter={cancelClear}
        onMouseLeave={scheduleClear}
        onClick={handleOpenMenu}
        className="fixed flex items-center justify-center rounded transition-colors hover-toolbar"
        style={{
          left,
          top,
          width: 24,
          height: 24,
          zIndex: 60,
          color: 'var(--app-text-muted)',
          backgroundColor: 'transparent',
          border: '1px solid var(--app-border-subtle)',
        }}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>,
      document.body,
    );
  })();

  return (
    <>
      {button}
      {menu && (
        <InsertElementMenu
          position={menu.position}
          onSelect={handleInsert}
          onClose={handleCloseMenu}
        />
      )}
    </>
  );
};
