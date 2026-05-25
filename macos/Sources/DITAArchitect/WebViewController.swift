import AppKit
import WebKit

final class WebViewController: NSViewController {

    static func makeWebView() -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(DITASchemeHandler(), forURLScheme: "dita")
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.allowsBackForwardNavigationGestures = false
        if #available(macOS 13.3, *) { webView.isInspectable = true }
        webView.load(URLRequest(url: URL(string: "dita://localhost/")!))
        return webView
    }
}
