import { toast } from 'sonner';
import { DITA_TOPIC_TYPE, type DitaTopicType } from '../constants/dita';
import { THEME_OPTIONS, type ThemeName } from '../components/Toolbar';
import { SYNTAX_THEME_OPTIONS, type SyntaxThemeName } from '../components/MonacoDitaEditor';
import { isNativeApp, nativeApiObject } from './native-api-object';

/**
 * ADR-016 decision 3 — the menu bridge.
 *
 * The macOS menu bar (AppDelegate.swift) drives the web app through these
 * `window.__ditaApi` methods. Each one does exactly what the in-app control
 * does, by calling the same handler, and answers in the tab API's JSON shape
 * (`{success, httpStatus, …}`); a bad argument is a 400, never a throw across
 * the bridge. `tests/native-menu-wiring.test.ts` reads MENU_BRIDGE_METHODS and
 * the Swift MenuAction table and asserts they agree (I1).
 */
export const MENU_BRIDGE_METHODS = [
  'newTopic',
  'closeActiveTab',
  'saveActiveTab',
  'openReplaceModal',
  'openExportModal',
  'openHerettoConnectModal',
  'openHerettoBrowserModal',
  'openReleaseNotes',
  'openKeyboardShortcuts',
  'toggleXmlPane',
  'setTheme',
  'setXmlTheme',
  'getActiveTheme',
  'exportFinished',
] as const;

export type MenuBridgeMethod = typeof MENU_BRIDGE_METHODS[number];

/** The cheat-sheet category the menu's shortcuts are listed under (defined with the shortcuts themselves). */
export { MENU_SHORTCUT_CATEGORY } from '../constants/keyboard-shortcuts';

export interface NativeMenuBridgeHandlers {
  getActiveTabId: () => string;
  handleNewTopic: (type: DitaTopicType) => void;
  handleCloseTab: (tabId: string) => void;
  /** The hook saves the active tab, or opens the Save browser when the tab has no Heretto file. */
  handleHerettoSave: () => Promise<void>;
  /** The diff modal when the tab has a replace target, else the browser in replace mode. */
  openReplace: () => void;
  exportPdf: () => void;
  openHerettoStatus: () => Promise<void>;
  openHerettoBrowser: (mode: 'open' | 'save' | 'replace') => Promise<void>;
  openReleaseNotes: () => void;
  openKeyboardShortcuts: () => void;
  toggleXmlPane: () => void;
  setTheme: (name: ThemeName) => void;
  setXmlTheme: (name: SyntaxThemeName) => void;
  getTheme: () => string;
  getXmlTheme: () => string;
}

const ok = (extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ success: true, httpStatus: 200, ...extra });
const bad = (error: string): string =>
  JSON.stringify({ success: false, httpStatus: 400, error });

const EXPORT_STATUSES = ['saved', 'cancelled', 'failed'] as const;
type ExportStatus = typeof EXPORT_STATUSES[number];

function isTopicType(v: unknown): v is DitaTopicType {
  return typeof v === 'string' && (DITA_TOPIC_TYPE as readonly string[]).includes(v);
}
function isThemeName(v: unknown): v is ThemeName {
  return typeof v === 'string' && THEME_OPTIONS.some(o => o.value === v);
}
function isSyntaxThemeName(v: unknown): v is SyntaxThemeName {
  return typeof v === 'string' && SYNTAX_THEME_OPTIONS.some(o => o.value === v);
}
function isExportStatus(v: unknown): v is ExportStatus {
  return typeof v === 'string' && (EXPORT_STATUSES as readonly string[]).includes(v);
}

export function registerNativeMenuBridge(handlers: NativeMenuBridgeHandlers): void {
  if (!isNativeApp()) return;

  const methods: Record<MenuBridgeMethod, (...args: unknown[]) => string> = {
    newTopic: (type: unknown): string => {
      if (!isTopicType(type)) return bad(`Unknown topic type "${String(type)}" — expected one of ${DITA_TOPIC_TYPE.join(', ')}`);
      handlers.handleNewTopic(type);
      return ok({ type });
    },

    closeActiveTab: (): string => {
      handlers.handleCloseTab(handlers.getActiveTabId());
      return ok();
    },

    saveActiveTab: (): string => {
      // Called now, not awaited: the hook owns the progress UI and the error
      // toasts, and the menu item has nothing to do with the outcome. Guarded so
      // neither a rejection nor a throw can reach the bridge as an error.
      try {
        const pending: unknown = handlers.handleHerettoSave();
        if (pending instanceof Promise) pending.catch(() => {});
      } catch {
        // the hook already reported it
      }
      return ok();
    },

    openReplaceModal: (): string => {
      handlers.openReplace();
      return ok();
    },

    openExportModal: (): string => {
      handlers.exportPdf();
      return ok();
    },

    openHerettoConnectModal: (): string => {
      void handlers.openHerettoStatus();
      return ok();
    },

    openHerettoBrowserModal: (): string => {
      void handlers.openHerettoBrowser('open');
      return ok();
    },

    openReleaseNotes: (): string => {
      handlers.openReleaseNotes();
      return ok();
    },

    openKeyboardShortcuts: (): string => {
      handlers.openKeyboardShortcuts();
      return ok();
    },

    toggleXmlPane: (): string => {
      handlers.toggleXmlPane();
      return ok();
    },

    setTheme: (name: unknown): string => {
      if (!isThemeName(name)) return bad(`Unknown theme "${String(name)}" — expected one of ${THEME_OPTIONS.map(o => o.value).join(', ')}`);
      handlers.setTheme(name);
      return ok({ theme: name });
    },

    setXmlTheme: (name: unknown): string => {
      if (!isSyntaxThemeName(name)) return bad(`Unknown XML syntax theme "${String(name)}" — expected one of ${SYNTAX_THEME_OPTIONS.map(o => o.value).join(', ')}`);
      handlers.setXmlTheme(name);
      return ok({ syntaxTheme: name });
    },

    getActiveTheme: (): string => ok({ theme: handlers.getTheme(), syntaxTheme: handlers.getXmlTheme() }),

    // Swift → JS (ADR-016 decision 6): the shell reports the export's outcome once
    // the file exists (or doesn't), so a success toast is never shown early.
    exportFinished: (status: unknown, message: unknown): string => {
      if (!isExportStatus(status)) return bad(`Unknown export status "${String(status)}"`);
      const text = typeof message === 'string' ? message : '';
      if (status === 'saved') {
        const fileName = text.split('/').pop() || 'PDF';
        toast.success(`Saved ${fileName}`);
      } else if (status === 'failed') {
        toast.error(`Export as PDF failed: ${text || 'unknown error'}`);
      }
      // 'cancelled': the writer closed the save panel on purpose — say nothing.
      return ok({ status });
    },
  };

  Object.assign(nativeApiObject(), methods);
}
