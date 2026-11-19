import AppKit
import WebKit
import UniformTypeIdentifiers

// MARK: – Files in and out of the web view (ADR-018 decision 12)

/// A WKWebView with no delegate does nothing for `<input type="file">` and
/// nothing for a blob download, so the web app's Import… and Export… would
/// silently fail in the native shell. This object answers both:
///
/// - **Open:** `WKUIDelegate.runOpenPanelWith` shows an `NSOpenPanel` and hands
///   the chosen file to the page, exactly as a browser does.
/// - **Save:** the page posts `{fileName, text}` to the `ditaSaveFile` message
///   (lib/native-file.ts); this shows an `NSSavePanel` with that name and writes
///   the text as UTF-8. Nothing is written without the writer choosing a place.
final class FileBridge: NSObject, WKUIDelegate, WKScriptMessageHandler {
    weak var hostWindow: NSWindow?

    // MARK: Open (<input type="file">)

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        let finish: (NSApplication.ModalResponse) -> Void = { response in
            completionHandler(response == .OK ? panel.urls : nil)
        }
        if let window = hostWindow ?? webView.window {
            panel.beginSheetModal(for: window, completionHandler: finish)
        } else {
            finish(panel.runModal())
        }
    }

    // MARK: Save (the ditaSaveFile message)

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let text = body["text"] as? String else { return }
        let suggested = (body["fileName"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "Untitled.json"

        let panel = NSSavePanel()
        panel.nameFieldStringValue = (suggested as NSString).lastPathComponent
        if (suggested as NSString).pathExtension.lowercased() == "json" {
            panel.allowedContentTypes = [.json]
        }
        panel.canCreateDirectories = true

        let finish: (NSApplication.ModalResponse) -> Void = { [weak self] response in
            guard response == .OK, let url = panel.url else { return }
            do {
                try text.write(to: url, atomically: true, encoding: .utf8)
            } catch {
                self?.alert("Could not save \(url.lastPathComponent)", detail: error.localizedDescription)
            }
        }
        if let window = hostWindow ?? message.webView?.window {
            panel.beginSheetModal(for: window, completionHandler: finish)
        } else {
            finish(panel.runModal())
        }
    }

    private func alert(_ message: String, detail: String) {
        let alert = NSAlert()
        alert.messageText = message
        alert.informativeText = detail
        alert.alertStyle = .warning
        alert.addButton(withTitle: "OK")
        if let window = hostWindow {
            alert.beginSheetModal(for: window)
        } else {
            alert.runModal()
        }
    }
}
