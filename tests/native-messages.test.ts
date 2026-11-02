// @vitest-environment jsdom
//
// ADR-016 decisions 5 and 6 — the two script messages the web app posts to the
// Swift shell: the print request (html + title, so the save panel can suggest a
// file name) and the UI-state push (theme + syntax theme, so the View menu's
// check marks can be set synchronously from a cache). Both are no-ops outside
// the native app.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postNativePrint } from '../lib/native-print';
import { pushNativeUiState } from '../lib/native-ui-state';

type Handler = { postMessage: (msg: unknown) => void };
function installHandlers(names: string[]): Record<string, Handler> {
  const handlers: Record<string, Handler> = {};
  for (const n of names) handlers[n] = { postMessage: vi.fn() };
  (window as unknown as { webkit?: unknown }).webkit = { messageHandlers: handlers };
  return handlers;
}

beforeEach(() => {
  delete (window as unknown as { webkit?: unknown }).webkit;
});

describe('postNativePrint', () => {
  it('posts {html, title} to the ditaPrint handler and reports that it did', () => {
    const h = installHandlers(['ditaPrint']);
    const posted = postNativePrint('<html>doc</html>', 'My Topic');
    expect(posted).toBe(true);
    expect(h.ditaPrint.postMessage).toHaveBeenCalledWith({ html: '<html>doc</html>', title: 'My Topic' });
  });

  it('returns false and posts nothing when there is no native handler (browser run mode)', () => {
    expect(postNativePrint('<html/>', 'T')).toBe(false);
  });

  it('returns false when webkit exists but the print handler does not', () => {
    const h = installHandlers(['ditaUi']);
    expect(postNativePrint('<html/>', 'T')).toBe(false);
    expect(h.ditaUi.postMessage).not.toHaveBeenCalled();
  });
});

describe('pushNativeUiState', () => {
  it('posts {theme, syntaxTheme} to the ditaUi handler', () => {
    const h = installHandlers(['ditaUi']);
    expect(pushNativeUiState({ theme: 'navy', syntaxTheme: 'daylight' })).toBe(true);
    expect(h.ditaUi.postMessage).toHaveBeenCalledWith({ theme: 'navy', syntaxTheme: 'daylight' });
  });

  it('is a silent no-op in the browser', () => {
    expect(pushNativeUiState({ theme: 'dark', syntaxTheme: 'material' })).toBe(false);
  });
});
