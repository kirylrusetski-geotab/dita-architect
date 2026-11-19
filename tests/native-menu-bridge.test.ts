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
import { SETTINGS_PAGES } from '../lib/settings';
import { DITA_TOPIC_TYPE } from '../constants/dita';
import { PANEL_IDS, VIEW_IDS } from '../lib/workbench-layout';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const PROFILES = [{ id: 'builtin:dark', name: 'Dark', builtIn: true }, { id: 'builtin:nord', name: 'Nord', builtIn: true }, { id: 'p-1', name: 'Nord, Dracula XML', builtIn: false }];

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
    togglePanel: rec('togglePanel') as NativeMenuBridgeHandlers['togglePanel'],
    toggleRightRail: rec('toggleRightRail'),
    focusView: rec('focusView') as NativeMenuBridgeHandlers['focusView'],
    openConvertModal: rec('openConvertModal'),
    openConnectMapModal: rec('openConnectMapModal'),
    reloadMap: rec('reloadMap'),
    disconnectMap: rec('disconnectMap'),
    openSettings: rec('openSettings') as NativeMenuBridgeHandlers['openSettings'],
    openAppearance: rec('openAppearance'),
    selectAppearanceProfile: ((id: string) => { (calls.selectAppearanceProfile ??= []).push([id]); return PROFILES.some(p => p.id === id); }) as NativeMenuBridgeHandlers['selectAppearanceProfile'],
    getAppearance: () => ({ active: { id: 'p-1', name: 'Nord, Dracula XML', base: 'nord', syntaxTheme: 'dracula', builtIn: false }, profiles: PROFILES }),
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
      getAppearance: () => ({ id: 'builtin:dark', name: 'Dark', base: 'dark' }),
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

  it.each(DITA_TOPIC_TYPE)('newTopic(%s)', (type) => {
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
    const res = JSON.parse(getApi().newTopic('glossary'));
    expect(res.success).toBe(false);
    expect(res.httpStatus).toBe(400);
    expect(res.error).toMatch(/glossary/);
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

  it('the no-argument rows each call their handler once', () => {
    forceNative();
    const h = makeHandlers();
    registerNativeMenuBridge(h);
    const api = getApi();
    ok(api.openReplaceModal());
    ok(api.openExportModal());
    ok(api.openHerettoConnectModal());
    ok(api.openReleaseNotes());
    ok(api.openKeyboardShortcuts());
    ok(api.toggleRightRail());
    ok(api.openConvertModal());
    ok(api.openConnectMapModal());
    ok(api.reloadMap());
    ok(api.disconnectMap());
    expect(h.calls.openReplace).toEqual([[]]);
    expect(h.calls.exportPdf).toEqual([[]]);
    expect(h.calls.openHerettoStatus).toEqual([[]]);
    expect(h.calls.openReleaseNotes).toEqual([[]]);
    expect(h.calls.openKeyboardShortcuts).toEqual([[]]);
    expect(h.calls.toggleRightRail).toEqual([[]]);
    expect(h.calls.openConvertModal).toEqual([[]]);
    expect(h.calls.openConnectMapModal).toEqual([[]]);
    expect(h.calls.reloadMap).toEqual([[]]);
    expect(h.calls.disconnectMap).toEqual([[]]);
  });

  it.each([...PANEL_IDS])('togglePanel(%s) toggles that panel (ADR-017)', (id) => {
    forceNative();
    const h = makeHandlers();
    registerNativeMenuBridge(h);
    expect(ok(getApi().togglePanel(id)).panel).toBe(id);
    expect(h.calls.togglePanel).toEqual([[id]]);
  });

  it.each([...VIEW_IDS])('focusView(%s) focuses that view (ADR-017)', (id) => {
    forceNative();
    const h = makeHandlers();
    registerNativeMenuBridge(h);
    expect(ok(getApi().focusView(id)).view).toBe(id);
    expect(h.calls.focusView).toEqual([[id]]);
  });

  it('togglePanel / focusView reject an unknown id with 400 and never call the handler', () => {
    forceNative();
    const h = makeHandlers();
    registerNativeMenuBridge(h);
    const a = JSON.parse(getApi().togglePanel('metadata'));
    const b = JSON.parse(getApi().focusView('timeline'));
    expect(a).toMatchObject({ success: false, httpStatus: 400 });
    expect(b).toMatchObject({ success: false, httpStatus: 400 });
    expect(a.error).toMatch(/metadata/);
    expect(b.error).toMatch(/timeline/);
    expect(h.calls.togglePanel).toBeUndefined();
    expect(h.calls.focusView).toBeUndefined();
  });

  it('openHerettoBrowserModal opens the browser in open mode', () => {
    forceNative();
    const h = makeHandlers();
    registerNativeMenuBridge(h);
    ok(getApi().openHerettoBrowserModal());
    expect(h.calls.openHerettoBrowser).toEqual([['open']]);
  });

  // ADR-018 decision 11: the theme methods are replaced by the appearance profile's.
  it('the retired theme methods are gone', () => {
    forceNative();
    registerNativeMenuBridge(makeHandlers());
    for (const m of ['setTheme', 'setXmlTheme', 'getActiveTheme']) expect(getApi()[m], m).toBeUndefined();
  });

  it('openSettings with no argument opens General; with a page id, that page', () => {
    forceNative();
    const h = makeHandlers();
    registerNativeMenuBridge(h);
    expect(ok(getApi().openSettings()).page).toBe('general');
    for (const p of SETTINGS_PAGES) expect(ok(getApi().openSettings(p.id)).page).toBe(p.id);
    expect(h.calls.openSettings).toEqual([['general'], ...SETTINGS_PAGES.map(p => [p.id])]);
  });

  it('openSettings rejects an unknown page with 400 naming the pages', () => {
    forceNative();
    const h = makeHandlers();
    registerNativeMenuBridge(h);
    const res = JSON.parse(getApi().openSettings('themes'));
    expect(res).toMatchObject({ success: false, httpStatus: 400 });
    expect(res.error).toMatch(/themes.*general, appearance, heretto, shortcuts, about/);
    expect(h.calls.openSettings).toBeUndefined();
  });

  it('openAppearance opens the drawer', () => {
    forceNative();
    const h = makeHandlers();
    registerNativeMenuBridge(h);
    ok(getApi().openAppearance());
    expect(h.calls.openAppearance).toEqual([[]]);
  });

  it('setAppearanceProfile switches to a known id; an unknown one is a 400 listing the known ids', () => {
    forceNative();
    const h = makeHandlers();
    registerNativeMenuBridge(h);
    expect(ok(getApi().setAppearanceProfile('builtin:nord')).profile).toBe('builtin:nord');
    const bad = JSON.parse(getApi().setAppearanceProfile('geotab'));
    expect(bad).toMatchObject({ success: false, httpStatus: 400 });
    expect(bad.error).toMatch(/"geotab".*builtin:dark, builtin:nord, p-1/);
    const notText = JSON.parse(getApi().setAppearanceProfile(7));
    expect(notText).toMatchObject({ success: false, httpStatus: 400 });
    expect(h.calls.selectAppearanceProfile).toEqual([['builtin:nord'], ['geotab']]);
  });

  it('getAppearance returns the active profile and the list', () => {
    forceNative();
    registerNativeMenuBridge(makeHandlers());
    const res = ok(getApi().getAppearance());
    expect(res.active).toEqual({ id: 'p-1', name: 'Nord, Dracula XML', base: 'nord', syntaxTheme: 'dracula', builtIn: false });
    expect(res.profiles).toEqual(PROFILES);
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
