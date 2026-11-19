// @vitest-environment jsdom
//
// ADR-016 decision 6 and ADR-018 decision 12 — the script messages the web app
// posts to the Swift shell: the print request (html + title, so the save panel
// can suggest a file name) and the save-file request (a profile export: file
// name + text, written through a save panel). Both are no-ops outside the
// native app. (ADR-016 decision 5's `ditaUi` theme push is retired with the
// View menu's theme submenus, ADR-018 decision 11.)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postNativePrint } from '../lib/native-print';
import { saveTextFile, safeFileName } from '../lib/native-file';

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

describe('saveTextFile', () => {
  it('posts {fileName, text} to the ditaSaveFile handler in the native app', () => {
    const h = installHandlers(['ditaSaveFile']);
    expect(saveTextFile('Warm_paper.json', '{"a":1}\n')).toBe('native');
    expect(h.ditaSaveFile.postMessage).toHaveBeenCalledWith({ fileName: 'Warm_paper.json', text: '{"a":1}\n' });
  });

  it('downloads in the browser (an <a download> click on a blob URL), posting nothing', () => {
    const created: string[] = [];
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => { created.push('blob:x'); return 'blob:x'; });
    URL.revokeObjectURL = vi.fn();
    const clicks: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicks.push(this.download); });
    try {
      expect(saveTextFile('p.json', '{}')).toBe('download');
      expect(clicks).toEqual(['p.json']);
      expect(created).toEqual(['blob:x']);
    } finally {
      click.mockRestore();
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });

  it('safeFileName keeps letters, digits, dot, dash and underscore', () => {
    expect(safeFileName('Warm paper', '.json')).toBe('Warm_paper.json');
    expect(safeFileName('Nord, Dracula XML', '.json')).toBe('Nord_Dracula_XML.json');
    expect(safeFileName('///', '.json')).toBe('profile.json');
  });
});
