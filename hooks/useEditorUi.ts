import { useState, useEffect } from 'react';
import type { Tab } from '../types/tab';

interface UseEditorUiParams {
  activeTabId: string;
  tabs: Tab[];
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
}

export function useEditorUi({
  activeTabId,
  tabs,
  setTabs,
}: UseEditorUiParams) {
  // ADR-018: the theme and syntax theme moved to the appearance profile (hooks/useAppearance.ts).
  // ADR-017: the header dropdowns, the XML pane's collapse state, its syntax-theme
  // menu and its Problems panel used to be owned here. The workbench layout hook
  // owns the pane now and each popover owns its own open state (components/workbench).
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false);

  // Ctrl+Enter to sync between editors (active tab)
  // ? or Cmd+/ to open keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, syncTrigger: t.syncTrigger + 1 } : t));
      }
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (!isEditing) {
        if (e.key === '?' || ((e.ctrlKey || e.metaKey) && e.key === '/')) {
          e.preventDefault();
          setIsKeyboardShortcutsOpen(prev => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, setTabs]);

  // Flush XML→Lexical sync when switching tabs
  useEffect(() => {
    const id = setTimeout(() => {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, syncTrigger: t.syncTrigger + 1 } : t));
    }, 50);
    return () => clearTimeout(id);
  }, [activeTabId, setTabs]);

  // Warn on unsaved changes when closing the browser tab
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasUnsaved = tabs.some(t => t.xmlContent !== t.savedXmlRef.current);
      if (hasUnsaved) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [tabs]);

  return {
    isKeyboardShortcutsOpen,
    setIsKeyboardShortcutsOpen,
  };
}
