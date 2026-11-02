export interface KeyboardShortcut {
  keys: string[];
  description: string;
  category: string;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl';

/** ADR-016: the cheat-sheet category for the native menu bar's shortcuts (re-exported by lib/native-menu-bridge.ts). */
export const MENU_SHORTCUT_CATEGORY = 'macOS menu (native app)';

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  {
    category: 'Editor',
    keys: [`${mod}+Enter`],
    description: 'Sync changes between visual and XML editors',
  },
  {
    category: 'Inline elements',
    keys: [`${mod}+Shift+U`],
    description: 'Wrap the selection in <uicontrol>',
  },
  {
    category: 'Inline elements',
    keys: [`${mod}+Shift+C`],
    description: 'Wrap the selection in <codeph>',
  },
  {
    category: 'XML Editor',
    keys: ['Shift+Alt+F'],
    description: 'Format / beautify the XML source',
  },
  {
    category: 'Modals',
    keys: ['Enter'],
    description: 'Confirm / insert (in dialogs)',
  },
  {
    category: 'Modals',
    keys: ['Escape'],
    description: 'Close dialog or dropdown',
  },
  {
    category: 'Navigation',
    keys: ['↑ / ↓'],
    description: 'Navigate menu items and dropdowns',
  },
  {
    category: 'Help',
    keys: ['?', `${mod}+/`],
    description: 'Open keyboard shortcuts',
  },
  // ADR-016 — the macOS menu bar (native app only; the browser has no menu bar).
  // tests/native-menu-wiring.test.ts checks these against the Swift menu table.
  {
    category: MENU_SHORTCUT_CATEGORY,
    keys: ['⌘N'],
    description: 'New Task topic',
  },
  {
    category: MENU_SHORTCUT_CATEGORY,
    keys: ['⇧⌘N'],
    description: 'New Concept topic',
  },
  {
    category: MENU_SHORTCUT_CATEGORY,
    keys: ['⌥⌘N'],
    description: 'New Reference topic',
  },
  {
    category: MENU_SHORTCUT_CATEGORY,
    keys: ['⌘O'],
    description: 'Open a local .dita / .xml file',
  },
  {
    category: MENU_SHORTCUT_CATEGORY,
    keys: ['⌘W'],
    description: 'Close the active tab',
  },
  {
    category: MENU_SHORTCUT_CATEGORY,
    keys: ['⌘S'],
    description: 'Save to Heretto (opens the Save browser for a tab without a Heretto file)',
  },
  {
    category: MENU_SHORTCUT_CATEGORY,
    keys: ['⌘\\'],
    description: 'Show or hide the XML pane',
  },
];
