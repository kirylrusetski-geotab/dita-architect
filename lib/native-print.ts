/**
 * ADR-016 decision 6 — hand the print HTML to the Swift shell.
 *
 * The shell's `ditaPrint` script message handler (PrintExporter.swift) runs the
 * native save panel, renders the HTML in a dedicated hidden web view, prints it
 * to a paginated PDF with page-number footers, and reports back through
 * `window.__ditaApi.exportFinished(status, message)` — so the web app shows no
 * toast here. Returns false (and posts nothing) outside the native app, where
 * the caller falls back to the browser's print dialog.
 */
export interface NativePrintRequest {
  html: string;
  title: string;
}

interface WebKitMessageHandlers {
  ditaPrint?: { postMessage: (msg: NativePrintRequest) => void };
}

export function postNativePrint(html: string, title: string): boolean {
  const handler = (window as unknown as { webkit?: { messageHandlers?: WebKitMessageHandlers } })
    .webkit?.messageHandlers?.ditaPrint;
  if (!handler) return false;
  handler.postMessage({ html, title });
  return true;
}
