/**
 * The one `window.__ditaApi` object the Swift shell calls into (ADR-007, ADR-016).
 *
 * Two registrars add methods to it — the tab API (`native-api-bridge.ts`) and the
 * menu bridge (`native-menu-bridge.ts`) — and each re-runs whenever its React
 * handlers change. Both merge into this shared object so neither ever wipes the
 * other's methods (ADR-016 decision 3).
 */
export type NativeApiObject = Record<string, unknown>;

/** True only inside the Swift WKWebView shell, which serves the app over `dita://`. */
export function isNativeApp(): boolean {
  return typeof location !== 'undefined' && location.protocol === 'dita:';
}

/** Returns `window.__ditaApi`, creating it on first use. */
export function nativeApiObject(): NativeApiObject {
  const w = window as unknown as { __ditaApi?: NativeApiObject };
  if (!w.__ditaApi) w.__ditaApi = {};
  return w.__ditaApi;
}
