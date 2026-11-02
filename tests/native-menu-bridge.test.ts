// @vitest-environment jsdom
//
// ADR-016 decision 3 — the menu bridge: every menu method calls the same
// handler the in-app control calls, answers in the tab API's JSON shape,
// rejects a bad argument with 400 instead of throwing across the bridge, and
// coexists with the tab-API registrar on one window.__ditaApi object.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { registerNativeMenuBridge, MENU_BRIDGE_METHODS, type NativeMenuBridgeHandlers } from '../lib/native-menu-bridge';
import { registerNativeApiBridge } from '../lib/native-api-bridge';
import { createTab } from '../types/tab';
import { THEME_OPTIONS } from '../components/Toolbar';
import { SYNTAX_THEME_OPTIONS } from '../components/MonacoDitaEditor';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

function makeHandlers(): NativeMenuBridgeHandlers & { calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = {};
  const rec = (name: string) => (...args: unknown[]) => { (calls[name] ??= []).push(args); };
  return {
    calls,
    getActiveTabId: () => 'tab-1',
    handleNewTopic: rec('handleNewTopic') as NativeMenuBridgeHandlers['handleNewTopic'],
    handleCloseTab: rec('handleCloseTab'),
    handleHerettoSave: rec('handleHerettoSave') as unknown as NativeMenuBridgeHandlers['handleHerettoSave'],
    openReplace: rec('openReplace'),
    exportPdf: rec('exportPdf'),
    openHerettoStatus: rec('openHerettoStatus') as unknown as NativeMenuBridgeHandlers['openHerettoStatus'],
    openHerettoBrowser: rec('openHerettoBrowser') as unknown as NativeMenuBridgeHandlers['openHerettoBrowser'],
    openReleaseNotes: rec('openReleaseNotes'),
    openKeyboardShortcuts: rec('openKeyboardShortcuts'),
    toggleXmlPane: rec('toggleXmlPane'),
    setTheme: rec('setTheme') as NativeMenuBridgeHandlers['setTheme'],
    setXmlTheme: rec('setXmlTheme') as NativeMenuBridgeHandlers['setXmlTheme'],
    getTheme: () => 'nord',
    getXmlTheme: () => 'dracula',
  };
}

function getApi(): Record<string, (...args: unknown[]) => string> {
  return (window as unknown as { __ditaApi: Record<string, (...args: unknown[]) => string> }).__ditaApi;
}

function forceNative() {
  Object.defineProperty(window, 'location', { value: { protocol: 'dita:' }, configurable: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete (window as unknown as { __ditaApi?: unknown }).__ditaApi;
});

describe('registration', () => {
  it('does nothing outside the native app (no dita: protocol)', () => {
    Object.defineProperty(window, 'location', { value: { protocol: 'http:' }, configurable: true });
    registerNativeMenuBridge(makeHandlers());
    expect((window as unknown as { __ditaApi?: unknown }).__ditaApi).toBeUndefined();
  });

  it('registers exactly the exported method list, and the list has no duplicates', () => {
    forceNative();
    registerNativeMenuBridge(makeHandlers());
    const api = getApi();
    for (const m of MENU_BRIDGE_METHODS) expect(typeof api[m], m).toBe('function');
    expect(new Set(MENU_BRIDGE_METHODS).size).toBe(MENU_BRIDGE_METHODS.length);
  });

  it('coexists with the tab-API registrar: re-registering either side keeps the other', () => {
    forceNative();
    const tab = createTab('<concept id="c"><title>T</title><conbody/></concept>');
    const tabApiHandlers = {
      getTabs: () => [tab],
      getActiveTabId: () => tab.id,
      getHerettoConnected: () => false,
      getTheme: () => 'dark',
      updateTab: vi.fn(),
      handleHerettoSave: vi.fn().mockResolvedValue(undefined),
      setTabs: vi.fn(),
      setActiveTabId: vi.fn(),
    };
    registerNativeApiBridge(tabApiHandlers);
    registerNativeMenuBridge(makeHandlers());
    registerNativeApiBridge(tabApiHandlers); // the app re-runs this effect on every tabs change
    const api = getApi();
    expect(typeof api.getStatus).toBe('function');
    expect(typeof api.newTopic).toBe('function');
    registerNativeMenuBridge(makeHandlers()); // and the menu side re-runs too
    expect(typeof api.getStatus).toBe('function');
    expect(typeof getApi().loadContent).toBe('function');
  });
});

describe('each method calls the in-app handler and answers {success, httpStatus}', () => {
  const ok = (raw: string) => {
    const res = JSON.parse(raw);
    expect(res.success).toBe(true);
    expect(res.httpStatus).toBe(200);
    return res;
  };

  it.each(['task', 'concept', 'reference'] as const)('newTopic(%s)', (type) => {
    forceNative();
    const h = makeHandlers();
    registerNativeMenuBridge(h);
    ok(getApi().newTopic(type));
    expect(h.calls.handleNewTopic).toEqual([[type]]);
  });

  it('newTopic rejects an unknown type with 400 and never calls the handler', () => {
    forceNative();
    const h = makeHandlers();
    registerNativeMenuBridge(h);
    const res = JSON.parse(getApi().newTopic('troubleshooting'));
    expect(res.success).toBe(false);
    expect(res.httpStatus).toBe(400);
    expect(res.error).toMatch(/troubleshooting/);
    expect(h.calls.handleNewTopic).toBeUndefined();
  });

  it('closeActiveTab closes the active tab through handleCloseTab (so the unsaved-edits confirm still runs)', () => {
    forceNative();
    const h = makeHandlers();
    registerNativeMenuBridge(h);
    ok(getApi().closeActiveTab());
    expect(h.calls.handleCloseTab).toEqual([['tab-1']]);
  });

  it('saveActiveTab calls handleHerettoSave with no tab id (the hook saves the active tab, or opens the Save browser)', () => {
    forceNative();
    const h = makeHandlers();
    registerNativeMenuBridge(h);
    ok(getApi().saveActiveTab());
    expect(h.calls.handleHerettoSave).toEqual([[]]);
  });

  it('openReplaceModal, openExportModal, openHerettoConnectModal, openReleaseNotes, openKeyboardShortcuts, toggleXmlPane', () => {
    forceNative();
    const h = makeHandlers();
    registerNativeMenuBridge(h);
    const api = getApi();
    ok(api.openReplaceModal());
    ok(api.openExportModal());
    ok(api.openHerettoConnectModal());
    ok(api.openReleaseNotes());
    ok(api.openKeyboardShortcuts());
    ok(api.toggleXmlPane());
    expect(h.calls.openReplace).toEqual([[]]);
    expect(h.calls.exportPdf).toEqual([[]]);
    expect(h.calls.openHerettoStatus).toEqual([[]]);
    expect(h.calls.openReleaseNotes).toEqual([[]]);
    expect(h.calls.openKeyboardShortcuts).toEqual([[]]);
    expect(h.calls.toggleXmlPane).toEqual([[]]);
  });

  it('openHerettoBrowserModal opens the browser in open mode', () => {
    forceNative();
    const h = makeHandlers();
    registerNativeMenuBridge(h);
    ok(getApi().openHerettoBrowserModal());
    expect(h.calls.openHerettoBrowser).toEqual([['open']]);
  });

  it.each(THEME_OPTIONS.map(o => o.value))('setTheme(%s) accepts every app theme', (name) => {
    forceNative();
    const h = makeHandlers();
    registerNativeMenuBridge(h);
    ok(getApi().setTheme(name));
    expect(h.calls.setTheme).toEqual([[name]]);
  });

  it.each(SYNTAX_THEME_OPTIONS.map(o => o.value))('setXmlTheme(%s) accepts every syntax theme', (name) => {
    forceNative();
    const h = makeHandlers();
    registerNativeMenuBridge(h);
    ok(getApi().setXmlTheme(name));
    expect(h.calls.setXmlTheme).toEqual([[name]]);
  });

  it('setTheme / setXmlTheme reject an unknown name with 400 and never call the handler', () => {
    forceNative();
    const h = makeHandlers();
    registerNativeMenuBridge(h);
    const a = JSON.parse(getApi().setTheme('geotab'));
    const b = JSON.parse(getApi().setXmlTheme('material-dark'));
    expect(a).toMatchObject({ success: false, httpStatus: 400 });
    expect(b).toMatchObject({ success: false, httpStatus: 400 });
    expect(a.error).toMatch(/geotab/);
    expect(b.error).toMatch(/material-dark/);
    expect(h.calls.setTheme).toBeUndefined();
    expect(h.calls.setXmlTheme).toBeUndefined();
  });

  it('getActiveTheme returns both themes', () => {
    forceNative();
    registerNativeMenuBridge(makeHandlers());
    const res = ok(getApi().getActiveTheme());
    expect(res.theme).toBe('nord');
    expect(res.syntaxTheme).toBe('dracula');
  });
});

describe('exportFinished — Swift reports the outcome, the web app shows the toast (FR-050 slice 1 item 4)', () => {
  it('saved → success toast naming the file', () => {
    forceNative();
    registerNativeMenuBridge(makeHandlers());
    const res = JSON.parse(getApi().exportFinished('saved', '/Users/me/Desktop/Topic.pdf'));
    expect(res.success).toBe(true);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(String((toast.success as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain('Topic.pdf');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('cancelled → no toast at all (the writer closed the save panel on purpose)', () => {
    forceNative();
    registerNativeMenuBridge(makeHandlers());
    const res = JSON.parse(getApi().exportFinished('cancelled', ''));
    expect(res.success).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('failed → error toast carrying the native message', () => {
    forceNative();
    registerNativeMenuBridge(makeHandlers());
    const res = JSON.parse(getApi().exportFinished('failed', 'The print operation produced no pages.'));
    expect(res.success).toBe(true);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(String((toast.error as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain('produced no pages');
  });

  it('an unknown status is a 400, not a throw', () => {
    forceNative();
    registerNativeMenuBridge(makeHandlers());
    const res = JSON.parse(getApi().exportFinished('exploded', ''));
    expect(res).toMatchObject({ success: false, httpStatus: 400 });
  });
});
