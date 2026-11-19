import AppKit
import WebKit

// MARK: – Web view factory

final class WebViewController: NSViewController {

    /// The shell's one web view. Two script message handlers reach Swift from the
    /// web app: `ditaPrint` (the PDF export request, PrintExporter.swift, ADR-016)
    /// and `ditaSaveFile` (a file the web app asks to save, e.g. an appearance
    /// profile export, FileBridge.swift, ADR-018). The UI delegate answers
    /// `<input type="file">` with an open panel (Import… in the Appearance drawer).
    static func makeWebView(printExporter: PrintExporter, fileBridge: FileBridge) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(DITASchemeHandler(), forURLScheme: "dita")

        config.userContentController.add(printExporter, name: "ditaPrint")
        config.userContentController.add(fileBridge, name: "ditaSaveFile")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.uiDelegate = fileBridge
        webView.allowsBackForwardNavigationGestures = false
        if #available(macOS 13.3, *) { webView.isInspectable = true }
        webView.load(URLRequest(url: URL(string: "dita://localhost/")!))
        return webView
    }
}
