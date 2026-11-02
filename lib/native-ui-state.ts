/**
 * ADR-016 decision 5 — push view state to the Swift shell.
 *
 * The View menu's Theme and XML Syntax Theme submenus show a check on the active
 * item. `NSMenuDelegate.menuNeedsUpdate` is synchronous and the JS bridge is not,
 * so the web app pushes the pair to the shell's `ditaUi` message handler whenever
 * either changes (and once on mount); the shell caches it and sets the check
 * marks from the cache. Returns false (and posts nothing) outside the native app.
 */
export interface NativeUiState {
  theme: string;
  syntaxTheme: string;
}

interface WebKitMessageHandlers {
  ditaUi?: { postMessage: (msg: NativeUiState) => void };
}

export function pushNativeUiState(state: NativeUiState): boolean {
  const handler = (window as unknown as { webkit?: { messageHandlers?: WebKitMessageHandlers } })
    .webkit?.messageHandlers?.ditaUi;
  if (!handler) return false;
  handler.postMessage({ theme: state.theme, syntaxTheme: state.syntaxTheme });
  return true;
}
