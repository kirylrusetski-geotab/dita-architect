import AppKit
import WebKit

// MARK: – Web view factory

final class WebViewController: NSViewController {

    /// The shell's one web view. Two script message handlers reach Swift from the
    /// web app (ADR-016): `ditaPrint` (the PDF export request, PrintExporter.swift)
    /// and `ditaUi` (the theme push that drives the View menu's check marks).
    static func makeWebView(uiState: UiState, printExporter: PrintExporter) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(DITASchemeHandler(), forURLScheme: "dita")

        config.userContentController.add(printExporter, name: "ditaPrint")
        config.userContentController.add(UiStateBridge(state: uiState), name: "ditaUi")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.allowsBackForwardNavigationGestures = false
        if #available(macOS 13.3, *) { webView.isInspectable = true }
        webView.load(URLRequest(url: URL(string: "dita://localhost/")!))
        return webView
    }
}
