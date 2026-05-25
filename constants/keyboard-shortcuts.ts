export interface KeyboardShortcut {
  keys: string[];
  description: string;
  category: string;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl';

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  {
    category: 'Editor',
    keys: [`${mod}+Enter`],
    description: 'Sync changes between visual and XML editors',
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
];
