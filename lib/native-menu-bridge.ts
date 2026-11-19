import { toast } from 'sonner';
import { DITA_TOPIC_TYPE, type DitaTopicType } from '../constants/dita';
import { isSettingsPage, SETTINGS_PAGES, type SettingsPage } from './settings';
import { isNativeApp, nativeApiObject } from './native-api-object';
import { PANEL_IDS, VIEW_IDS, type PanelId, type ViewId } from './workbench-layout';

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
  // ADR-017: the workbench. `togglePanel` replaces `toggleXmlPane` (the XML is one of the rail's panels).
  'togglePanel',
  'toggleRightRail',
  'focusView',
  'openConvertModal',
  'openConnectMapModal',
  'reloadMap',
  'disconnectMap',
  // ADR-018 decision 11: the Theme / XML Syntax Theme submenus are gone; the look is a profile.
  'openSettings',
  'openAppearance',
  'setAppearanceProfile',
  'getAppearance',
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
  /** ADR-017: the layout hook's actions, one per View-menu row. */
  togglePanel: (id: PanelId) => void;
  toggleRightRail: () => void;
  focusView: (id: ViewId) => void;
  /** FR-069's orphan: Convert Topic Type… had no menu-bar home. */
  openConvertModal: () => void;
  /** ADR-013's map commands, moved from the retired Heretto dropdown. */
  openConnectMapModal: () => void;
  reloadMap: () => void;
  disconnectMap: () => void;
  /** ADR-018: Settings (DITA Architect ▸ Settings… ⌘,) on a page, and the Appearance drawer (View ▸ Appearance…). */
  openSettings: (page: SettingsPage) => void;
  openAppearance: () => void;
  /** Switch to a profile by id; false when no profile has that id. */
  selectAppearanceProfile: (id: string) => boolean;
  getAppearance: () => AppearanceSummary;
}

export interface AppearanceSummary {
  active: { id: string; name: string; base: string; syntaxTheme: string; builtIn: boolean };
  profiles: Array<{ id: string; name: string; builtIn: boolean }>;
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
function isExportStatus(v: unknown): v is ExportStatus {
  return typeof v === 'string' && (EXPORT_STATUSES as readonly string[]).includes(v);
}
function isPanelId(v: unknown): v is PanelId {
  return typeof v === 'string' && (PANEL_IDS as readonly string[]).includes(v);
}
function isViewId(v: unknown): v is ViewId {
  return typeof v === 'string' && (VIEW_IDS as readonly string[]).includes(v);
}

export function registerNativeMenuBridge(handlers: NativeMenuBridgeHandlers): void {
  if (!isNativeApp()) return;

  const methods: Record<MenuBridgeMethod, (...args: unknown[]) => string> = {
    newTopic: (type: unknown): string => {
      if (!isTopicType(type)) return bad(`Unknown topic type "${String(type)}": expected one of ${DITA_TOPIC_TYPE.join(', ')}`);
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

    togglePanel: (id: unknown): string => {
      if (!isPanelId(id)) return bad(`Unknown panel "${String(id)}": expected one of ${PANEL_IDS.join(', ')}`);
      handlers.togglePanel(id);
      return ok({ panel: id });
    },

    toggleRightRail: (): string => {
      handlers.toggleRightRail();
      return ok();
    },

    focusView: (id: unknown): string => {
      if (!isViewId(id)) return bad(`Unknown view "${String(id)}": expected one of ${VIEW_IDS.join(', ')}`);
      handlers.focusView(id);
      return ok({ view: id });
    },

    openConvertModal: (): string => {
      handlers.openConvertModal();
      return ok();
    },

    openConnectMapModal: (): string => {
      handlers.openConnectMapModal();
      return ok();
    },

    reloadMap: (): string => {
      handlers.reloadMap();
      return ok();
    },

    disconnectMap: (): string => {
      handlers.disconnectMap();
      return ok();
    },

    // A row with no argument opens General; the smoke may name a page.
    openSettings: (page: unknown): string => {
      const p = page === undefined || page === null || page === '' ? 'general' : page;
      if (!isSettingsPage(p)) return bad(`Unknown settings page "${String(page)}": expected one of ${SETTINGS_PAGES.map(x => x.id).join(', ')}`);
      handlers.openSettings(p);
      return ok({ page: p });
    },

    openAppearance: (): string => {
      handlers.openAppearance();
      return ok();
    },

    setAppearanceProfile: (id: unknown): string => {
      const known = handlers.getAppearance().profiles;
      if (typeof id !== 'string' || !handlers.selectAppearanceProfile(id)) {
        return bad(`Unknown appearance profile "${String(id)}": expected one of ${known.map(p => p.id).join(', ')}`);
      }
      return ok({ profile: id });
    },

    getAppearance: (): string => ok({ ...handlers.getAppearance() }),

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
