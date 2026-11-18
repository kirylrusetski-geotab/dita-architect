import { useState, useEffect, useCallback } from 'react';
import type { Tab } from '../types/tab';
import type { ThemeName } from '../components/Toolbar';
import type { SyntaxThemeName } from '../components/MonacoDitaEditor';
import { SYNTAX_THEME_OPTIONS } from '../components/MonacoDitaEditor';

interface UseEditorUiParams {
  activeTabId: string;
  tabs: Tab[];
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
}

/**
 * FR-061: map a stored theme preference to a valid ThemeName. The "geotab"
 * theme was renamed "navy" in v0.9.7; a stored `geotab` resolves to `navy` so
 * existing users keep their palette. Anything unrecognised falls back to dark.
 */
export const resolveStoredTheme = (stored: string | null): ThemeName => {
  if (stored === 'geotab') return 'navy';
  if (stored === 'light' || stored === 'claude' || stored === 'nord' || stored === 'solarized' || stored === 'navy' || stored === 'dark') return stored;
  return 'dark';
};

export function useEditorUi({
  activeTabId,
  tabs,
  setTabs,
}: UseEditorUiParams) {
  const [theme, setTheme] = useState<ThemeName>(() => {
    const stored = localStorage.getItem('dita-architect-theme');
    const resolved = resolveStoredTheme(stored);
    // FR-061: persist the migrated name so the legacy value does not linger.
    if (stored !== null && stored !== resolved) localStorage.setItem('dita-architect-theme', resolved);
    return resolved;
  });

  const handleThemeChange = useCallback((newTheme: ThemeName) => {
    setTheme(newTheme);
    localStorage.setItem('dita-architect-theme', newTheme);

    // Auto-correct syntax theme when light/dark parity would be violated
    setSyntaxTheme(prev => {
      const prevMode = SYNTAX_THEME_OPTIONS.find(o => o.value === prev)?.mode ?? 'dark';
      const goingLight = newTheme === 'light';
      if (goingLight && prevMode === 'dark') {
        localStorage.setItem('dita-architect-syntax-theme', 'daylight');
        return 'daylight';
      }
      if (!goingLight && prevMode === 'light') {
        localStorage.setItem('dita-architect-syntax-theme', 'material');
        return 'material';
      }
      return prev;
    });
  }, []);

  const [syntaxTheme, setSyntaxTheme] = useState<SyntaxThemeName>(() => {
    const stored = localStorage.getItem('dita-architect-syntax-theme');
    const valid: SyntaxThemeName[] = ['material', 'github', 'monokai', 'dracula', 'one-dark', 'catppuccin', 'daylight'];
    if (stored && valid.includes(stored as SyntaxThemeName)) return stored as SyntaxThemeName;
    return 'material';
  });

  const handleSyntaxThemeChange = useCallback((newTheme: SyntaxThemeName) => {
    setSyntaxTheme(newTheme);
    localStorage.setItem('dita-architect-syntax-theme', newTheme);
  }, []);

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
    theme,
    syntaxTheme,
    isKeyboardShortcutsOpen,
    setIsKeyboardShortcutsOpen,
    handleThemeChange,
    handleSyntaxThemeChange,
  };
}
