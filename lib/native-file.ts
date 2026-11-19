/**
 * ADR-018 decision 12 — save a text file the writer names.
 *
 * In the native app a blob download goes nowhere (the shell's WKWebView has no
 * download delegate), so the request is posted to the shell's `ditaSaveFile`
 * script message, which shows a save panel and writes the file (the
 * `ditaPrint` pattern, ADR-016 decision 6). In the browser it is an ordinary
 * download. Returns which path was taken.
 */
interface SaveFileMessage {
  fileName: string;
  text: string;
}

interface WebKitMessageHandlers {
  ditaSaveFile?: { postMessage: (msg: SaveFileMessage) => void };
}

export function saveTextFile(fileName: string, text: string, mime = 'application/json'): 'native' | 'download' {
  const handler = (window as unknown as { webkit?: { messageHandlers?: WebKitMessageHandlers } }).webkit?.messageHandlers?.ditaSaveFile;
  if (handler) {
    handler.postMessage({ fileName, text });
    return 'native';
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return 'download';
}

/** A file name from a profile name: letters, digits, dot, dash and underscore; never empty. */
export function safeFileName(name: string, ext: string): string {
  const base = name.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'profile';
  return `${base}${ext}`;
}
