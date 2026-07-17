import AppKit
import WebKit

// MARK: – Print bridge

/// Receives the print-ready HTML string from JS via
/// `window.webkit.messageHandlers.ditaPrint.postMessage(html)`, writes it to a
/// temp file, and opens it in the system browser. The user presses ⌘P in the
/// browser to get the native print dialog and save as PDF.
///
/// This avoids WKWebView.printOperation, which requires the WebKit backing store
/// to be populated — unreliable for off-screen views and consistently produces
/// blank pages when called from inside the app's own WKWebView shell.
final class PrintBridge: NSObject, WKScriptMessageHandler {

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard let html = message.body as? String else { return }

        let tmpDir = URL(fileURLWithPath: NSTemporaryDirectory())
        let timestamp = Int(Date().timeIntervalSince1970)
        let fileURL = tmpDir.appendingPathComponent("dita-print-\(timestamp).html")

        do {
            try html.write(to: fileURL, atomically: true, encoding: .utf8)
            NSWorkspace.shared.open(fileURL)
        } catch {
            print("[PrintBridge] Failed to write print file: \(error)")
        }
    }
}

// MARK: – Web view factory

final class WebViewController: NSViewController {

    static func makeWebView() -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(DITASchemeHandler(), forURLScheme: "dita")

        // Wire up the print bridge so JS can trigger native macOS printing.
        let printBridge = PrintBridge()
        config.userContentController.add(printBridge, name: "ditaPrint")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.allowsBackForwardNavigationGestures = false
        if #available(macOS 13.3, *) { webView.isInspectable = true }
        webView.load(URLRequest(url: URL(string: "dita://localhost/")!))
        return webView
    }
}
